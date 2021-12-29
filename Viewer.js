const maxOfCountOfBooks = 203380;
let countOfRenderedBook = 60000;
const countOfBooksPerStep = 3000;

let randomSelectedShelfName = "cozy-mystery";
let currentShelfName = randomSelectedShelfName;

// array of string
let shelfNames;

// used to determine the color of the book
let maxOfBookCount;

// used for getting geometry for rendering and checking intersect
let totalBooksData = [];

let threeJsPoints;
const useOrbitControls = false;
const debugScene = false;
const sceneBoundingRadius = 3;

let canvasWidth, canvasHeight, camera, scene, renderer, rayCaster, controls;

// scene range
const minX = -3.17447, maxX = 3.530256, minY = -3.2551053, maxY = 3.5595973;
const basePointSize = 0.5;
const tradeOffBetweenSemanticAndGeometric = 0.5;

let viewer;
let hoverContainer;
const tooltipWidth = 220;
let tooltipState = {display: "none"};

class Viewer {
    constructor(containerId) {
        viewer = this;

        this._container = document.getElementById(containerId);

        canvasWidth = this._container.offsetWidth;
        canvasHeight = this._container.offsetHeight;

        document.getElementById('book-total-number').max = maxOfCountOfBooks;
        document.getElementById('book-total-number').value = countOfRenderedBook;
        document.getElementById('book-number').innerText = countOfRenderedBook;
        document.getElementById('book-total-number').oninput = (event) =>{
            console.log('countOfRenderedBook changed');

            countOfRenderedBook = document.getElementById('book-total-number').value;
            document.getElementById('book-number').innerText = countOfRenderedBook;
        };

        document.getElementById('book-total-number').onchange = (event) =>{
            console.log('countOfRenderedBook changed');

            countOfRenderedBook = document.getElementById('book-total-number').value;
            document.getElementById('book-number').innerText = countOfRenderedBook;
            viewer.updateScene();
        };

        this._init();
    }

    async _init() {
        this._initThreejs();
        await this._setupScene();

        await addShelfNames();
        chooseShelf();
        this.updateScene();
        this._loop(0);
    }

    _initThreejs() {
        const aspect = canvasWidth / canvasHeight;
        const fov = 1, near = 0.3, far = 150;

        // note that fov will be again determined in zoomHandler
        camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

        // scene
        scene = new THREE.Scene();

        const background_color = "#080e36";

        scene.background = new THREE.Color(background_color);
        scene.fog = new THREE.Fog(0xcce0ff, 500, 10000);

        //renderer
        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(canvasWidth, canvasHeight);

        this._container.appendChild(renderer.domElement);

        if(useOrbitControls) {
            // controls
            controls = new THREE.OrbitControls(camera, renderer.domElement);

            controls.maxPolarAngle = Math.PI * 0.5;
            controls.minDistance = 0;
            controls.maxDistance = sceneBoundingRadius * 10;
        }

        rayCaster = new THREE.Raycaster();

        let d3View = d3.select(renderer.domElement);

        const minScale = 80;
        const maxScale = 40000000;

        let d3Zoom = d3.zoom()
            .scaleExtent([minScale, maxScale])
            .on('zoom', () => {
                let d3_transform = d3.event.transform;

                zoomHandler(d3_transform);
                removeHighlights();
                hideTooltip();
            });

        d3View.call(d3Zoom);

        //disable zoom by double click
        d3View.on('dblclick.zoom', null);

        const initial_transform = d3.zoomIdentity.translate(canvasWidth / 2, canvasHeight / 2).scale(minScale);

        d3Zoom.transform(d3View, initial_transform);

        zoomHandler(initial_transform);

        d3View.on("mousemove", () => {
            if(!threeJsPoints)
                return;

            if(totalBooksData.length === 0)
                return;

            let [mouseX, mouseY] = d3.mouse(d3View.node());
            let mouse_position = [mouseX, mouseY];
            checkIntersects(mouse_position);
        });

        d3View.on("mousedown", () => {
            removeHighlights();
            hideTooltip();
        });

        d3View.on("dblclick", () => {
            window.open("https://www.amazon.com/gp/search?ie=UTF8&tag=seethegalaxy-20&linkCode=ur2&linkId=7748085b1a234aa9aae28c0462805062&camp=1789&creative=9325&index=books&keywords="
                + tooltipState.title + ' ' + tooltipState.author, '_blank')

            //window.open("https://www.goodreads.com/book/show/" + tooltipState.url, '_blank')
        });

        d3View.on("mouseleave", () => {
            removeHighlights();
            hideTooltip();
        });

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    async _setupScene() {
        if(debugScene)
            this._setupSceneDebugHelpers();

        hoverContainer = new THREE.Object3D();
        scene.add(hoverContainer);

        const positions = new Float32Array( maxOfCountOfBooks * 3 ); // 3 vertices per point
        const colors = new Float32Array( maxOfCountOfBooks * 3 ); // 3 vertices per point

        const bufferGeometry = new THREE.BufferGeometry();

        bufferGeometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
        bufferGeometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

        let pointsMaterial = new THREE.PointsMaterial({
            size: basePointSize,
            sizeAttenuation: true,
            vertexColors: THREE.VertexColors,
            opacity: 0.8,
            map: new THREE.TextureLoader().load("https://blog.fastforwardlabs.com/images/2018/02/circle-1518727951930.png"),
            transparent: true
        });

        threeJsPoints = new THREE.Points(bufferGeometry, pointsMaterial);

        scene.add(threeJsPoints);
    }

    _setupSceneDebugHelpers() {
        const axesHelper = new THREE.AxesHelper(sceneBoundingRadius * 1.5);
        scene.add(axesHelper);

        const size = sceneBoundingRadius * 2;
        const divisions = 10;

        const gridHelper = new THREE.GridHelper(size, divisions);
        scene.add(gridHelper);
    }

    _initPositions() {
        const positions = threeJsPoints.geometry.attributes.position.array;

        for(let i = 0; i < maxOfCountOfBooks; i++) {
            positions[ i * 3 ] = 10;
            positions[ i * 3 + 1 ] = 10;
            positions[ i * 3 + 2 ] = 0;
        }
    }

    _updateThreeJsPoints(start, booksData, maxOfBookCount, z) {
        const positions = threeJsPoints.geometry.attributes.position.array;
        const colors = threeJsPoints.geometry.attributes.color.array;

        const maxCountLog = Math.log(1 + maxOfBookCount);
        let bookCountLog;
        let threeJsColor;

        for(let i = 0; i < booksData.length; i++) {
            let bookData = booksData[i];

            positions[ (i + start) * 3 ] = bookData[5];
            positions[ (i + start) * 3 + 1 ] = bookData[6];
            positions[ (i + start) * 3 + 2 ] = z;

            // store z
            booksData[i].z = z;

            bookCountLog = Math.log(1 + bookData[3]);

            threeJsColor = new THREE.Color(getRGBColorStringFromLog(bookCountLog, maxCountLog));

            colors[ (i + start) * 3 ] = threeJsColor.r;
            colors[ (i + start) * 3 + 1 ] = threeJsColor.g;
            colors[ (i + start) * 3 + 2 ] = threeJsColor.b;

            if(bookData[3] > maxOfBookCount){
                console.warn(`bookData[3] ${bookData[3]} maxOfBookCount ${maxOfBookCount}`);

                maxOfBookCount = booksData[3];
            }
        }

        threeJsPoints.geometry.attributes.position.needsUpdate = true;
        threeJsPoints.geometry.attributes.color.needsUpdate = true;

        threeJsPoints.geometry.computeBoundingSphere();
    }

    async updateScene() {
        disableUI();

        this._initPositions();
        totalBooksData = [];

        let rank = 1;
        let z = 0;
        const zStep = 1;

        while(rank < countOfRenderedBook) {
            const bookData = await getBookData(currentShelfName, rank, rank + countOfBooksPerStep);

            if(rank === 1)
                maxOfBookCount = bookData[0][3];

            totalBooksData.push(...bookData);

            this._updateThreeJsPoints(rank - 1, bookData, maxOfBookCount, z);

            rank += countOfBooksPerStep;
            z -= zStep;

            threeJsPoints.geometry.setDrawRange(0, rank - 1);
        }

        enableUI();
    }

    onWindowResize() {
        const width = this._container.offsetWidth;
        const height = this._container.offsetHeight;

        canvasWidth = width;
        canvasHeight = height;

        camera.aspect = canvasWidth / canvasHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvasWidth, canvasHeight);
    }

    _loop(now) {
        this._render();

        this._updateTooltip();
        window.requestAnimationFrame(this._loop.bind(this));
    }

    _render() {
        renderer.render(scene, camera);
    }

    _updateTooltip() {
        let tooltipElement = document.getElementById('tooltip');

        tooltipElement.style.display = tooltipState.display;

        if(tooltipState.display === 'none')
            return;

        tooltipElement.style.left = tooltipState.left + 'px';

        const threejsContainer = document.getElementById('threejsContainer');

        tooltipElement.style.width = tooltipWidth + 'px';

        let tooltipCover = document.getElementById('tooltip_cover');

        if(tooltipState.cover) {
            tooltipCover.src = tooltipState.cover;
            tooltipCover.style.width = (tooltipWidth - 5) + 'px'
        }
        else {
            tooltipCover.src = '';
        }

        document.getElementById('tooltip_top_shelves').innerText = tooltipState.top_shelves;

        let tooltipRank = document.getElementById('tooltip_rank');

        tooltipRank.style.background = getRGBColorStringFromCount(tooltipState.count, maxOfBookCount);
        tooltipRank.innerText = 'Rank ' + tooltipState.rank + ' in ' + currentShelfName;

        const originHeight = threejsContainer.offsetTop;

        // console.log('originHeight + height - tooltip_width * 2.1', originHeight + height - tooltip_width * 2.1);
        // console.log('originHeight + tooltip_state.top', originHeight + tooltip_state.top);

        tooltipElement.style.top = Math.max(originHeight + 10, Math.min( originHeight + canvasHeight - tooltipElement.offsetHeight - 10 , originHeight + tooltipState.top - 100)) + 'px';

        //console.log(tooltipElement.offsetHeight);
    }
}