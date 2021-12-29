function enableUI(){
     setDisabled(false);
}

function disableUI() {
    setDisabled(true);
}

function setDisabled(b) {
    document.getElementById('book-total-number').disabled = b;
    document.getElementById('something-else').disabled = b;
    document.getElementById('shelf-names').disabled = b;
}

function zoomHandler(d3_transform) {
    let scale = d3_transform.k;

    let x = -(d3_transform.x - canvasWidth / 2) / scale;
    let y = (d3_transform.y - canvasHeight / 2) / scale;
    let z = get_camera_z(Math.log(scale));

    camera.position.set(x, y, z);

    camera.fov = needed_fov(canvasHeight, z, scale);

    // console.log('scale', scale);
    // console.log('camera z', z);
    // console.log('fov', camera.fov);

    camera.updateProjectionMatrix();
}

function get_camera_z(zoom_level) {
    return canvasHeight / Math.exp(zoom_level * tradeOffBetweenSemanticAndGeometric);
}

function needed_fov(viz_height, camera_z, scale) {
    const fov_height = viz_height / scale;
    const half_fov_radians = Math.atan(fov_height/(2 * camera_z));
    const half_fov = toDegrees(half_fov_radians);

    return half_fov * 2
}

async function getBookData(shelf, fromRank, toRank) {
    let apiUrl = 'https://seethegalaxy.com/q/books_by_shelf_rank';

    apiUrl = `${apiUrl}?shelf=${shelf}&from_rank=${fromRank}&to_rank=${toRank}`;

    let ret = await d3.json(apiUrl);

    //console.log(ret);

    return ret;
}

function mouseToThree(mouseX, mouseY) {
    return new THREE.Vector3(
        mouseX / canvasWidth * 2 - 1,
        -(mouseY / canvasHeight) * 2 + 1,
        1
    );
}

function checkIntersects(mousePosition) {
    let mouseVector = mouseToThree(...mousePosition);
    rayCaster.setFromCamera(mouseVector, camera);

    let intersects = rayCaster.intersectObject(threeJsPoints);

    if (intersects[0]) {
        let sorted_intersects = sortIntersectsByDistanceToRay(intersects);
        let intersect = sorted_intersects[0];
        let index = intersect.index;

        if(totalBooksData.length < index + 1) {
            // data is not yet fetched
            return;
        }

        let datum = totalBooksData[index];

        highlightPoint(datum);
        showTooltip(mousePosition, datum);
    } else {
        removeHighlights();
        hideTooltip();
    }
}

function sortIntersectsByDistanceToRay(intersects) {
    intersects.sort(function(a, b){return a.distanceToRay - b.distanceToRay});

    return intersects;
}

function highlightPoint(datum) {
    removeHighlights();

    let geometry = new THREE.Geometry();

    geometry.vertices.push(
        new THREE.Vector3(
            datum[5],
            datum[6],
            datum.z
        )
    );

    const bookCountLog = Math.log(1 + datum[3]);
    const maxCountLog = Math.log(1 + maxOfBookCount);

    geometry.colors = [new THREE.Color(d3.interpolateViridis(bookCountLog / maxCountLog))];

    let material = new THREE.PointsMaterial({
        size: basePointSize * 1.5,
        sizeAttenuation: true,
        vertexColors: THREE.VertexColors,
        map: new THREE.TextureLoader().load("https://blog.fastforwardlabs.com/images/2018/02/circle-1518727951930.png"),
        transparent: true
    });

    let point = new THREE.Points(geometry, material);

    hoverContainer.add(point);
}

function removeHighlights() {
    if (!hoverContainer)
        return;

    hoverContainer.remove(...hoverContainer.children);
}

function showTooltip(mouse_position, datum) {
    let x_offset = 50;
    let y_offset = 0;

    tooltipState.display = "block";

    if (mouse_position[0] < canvasWidth - tooltipWidth - x_offset - 30) {
        tooltipState.left = mouse_position[0] + x_offset + 30;
    } else {
        tooltipState.left = mouse_position[0] - tooltipWidth - x_offset;
    }

    // console.log('mouse y', mouse_position[1])

    tooltipState.top = mouse_position[1] + y_offset;
    tooltipState.title = datum[7];
    tooltipState.author = datum[8];
    tooltipState.count = datum[3];
    tooltipState.rank = datum[1];
    tooltipState.cover = datum[9];
    tooltipState.url = datum[2];
    tooltipState.top_shelves = datum[10];
    tooltipState.z = datum.z;
}

function hideTooltip() {
    tooltipState.display = "none";
}

function chooseShelf() {
    console.assert(shelfNames !== undefined, 'shelfNames should be defined');

    function choose(choices) {
        const index = Math.floor(Math.random() * choices.length);

        return choices[index];
    }

    randomSelectedShelfName = choose(shelfNames.map(shelf => shelf[0]).slice(0, 50));

    const shelfNamesSelect = document.getElementById('shelf-names');
    shelfNamesSelect.value = randomSelectedShelfName;

    currentShelfName = randomSelectedShelfName;
}

async function addShelfNames() {
    // get shelf name list
    shelfNames = await d3.json('https://seethegalaxy.com/q/shelfnames');

    console.log('shelfNames', shelfNames);

    const names = [...shelfNames.map(shelf => shelf[0]).slice(0, 20), ...shelfNames.map(shelf => shelf[0]).sort()];

    const shelfNamesSelect = document.getElementById('shelf-names');

    for (let i = 0; i <= names.length; i++){
        let option = document.createElement('option');

        option.value = names[i];
        option.innerHTML = names[i];

        shelfNamesSelect.appendChild(option);
    }

    shelfNamesSelect.addEventListener('change', () => {
        currentShelfName = shelfNamesSelect.value;

        viewer.updateScene();
    });

    document.getElementById('something-else').addEventListener('click', ()=>{
        chooseShelf();
        viewer.updateScene();
    })
}

function toDegrees (angle) {
    return angle * (180 / Math.PI);
}

function getRGBColorStringFromCount(count, maxCount) {
    return getRGBColorStringFromLog(Math.log(1 + count), Math.log(1 + maxCount));
}

function getRGBColorStringFromLog(log, maxLog) {
    return d3.interpolateViridis(log / maxLog);
}