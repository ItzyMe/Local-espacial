var worldMap;
var terminator;
var issMarkerIcon;
var sunMarkerIcon;
var issMarker;
var sunMarker;
var issFootprint;
var issPath;
var gpsCircle;
var data;

// Método responsável por iniciar o sistema de tracking da ISS.
function init() {

    worldMap = L.map('worldMap', {worldCopyJump: true});
    worldMap.setZoom(2);

    let bounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));
    
    L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>',
        bounds: bounds,
        noWrap: false,
        minZoom: 2,
        maxZoom: 5
    }).addTo(worldMap);

    issMarkerIcon = L.divIcon({
        className: 'issMarkerIcon',
        iconSize: L.point(50, 38)
    });

    sunMarkerIcon = L.icon({
        iconUrl: 'img/sunMarkerIcon.svg',
        iconSize: [50, 50]
    });

    worldMap.setView([0, 0], worldMap.getZoom());

    terminator = L.terminator().addTo(worldMap);

    loadData();
    overlayDayNight();

    let options = document.getElementsByClassName("options");

    for (i = 0; i < options.length; i++) {
        options[i].disabled = false;
    }
}

// Método responsável por carregar os dados da ISS.
function loadData() {

    getData('https://api.wheretheiss.at/v1/satellites/25544', 'GET', function (data) {

        this.data = data;

        updateIss(data.latitude, data.longitude);
        updateSun(data.solar_lat, data.solar_lon);
        updateDataPanel(data);

        setTimeout(loadData, 1000);

    }, function (error) {
        
        document.getElementById('message').innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">'
                + '<symbol id="exclamation-triangle-fill" fill="currentColor" viewBox="0 0 16 16">'
                + '<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>'
                + '</symbol>'
            + '</svg>'
            + '<div class="alert alert-danger alert-dismissible fade show" role="alert">'
                + '<svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="Danger:"><use xlink:href="#exclamation-triangle-fill"/></svg>'
                + `<strong>${error}</strong> - Unfortunately we were unable to load the data.`
                + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>'
            + '</div>';
    });
}

// Método responsável pelo controle da centralização travada da ISS no mapa.
function issLockOnControl(lat = data.latitude, lng = data.longitude) {

    if (document.getElementById('chkLockOn').checked) {
        worldMap.setView([lat, lng], worldMap.getZoom());
        worldMap.dragging.disable();
        var timeout = setTimeout(issLockOnControl, 1000);
    } else {
        clearTimeout(timeout);
        worldMap.dragging.enable();
    }
}

// Método responsável pelo controle da área de visibilidade da ISS.
function issFootprintControl(lat = data.latitude, lng = data.longitude, alt = data.altitude) {

    if (document.getElementById('chkFootprint').checked) {
        updateIssFootprint(lat, lng, alt);
        var timeout = setTimeout(issFootprintControl, 1000);
    } else if(issFootprint) {
        clearTimeout(timeout);
        worldMap.removeLayer(issFootprint);
        issFootprint = undefined;
    }
}

// Método responsável pelo controle da localização GPS do usuário.
function gpsControl() {

    if (window.document.getElementById('chkGps').checked) {
        worldMap.locate({watch: false, setView: true, maxZoom: worldMap.getZoom()});
        worldMap.on('locationfound', onLocateFound);
    } else {
        worldMap.stopLocate();
        worldMap.removeLayer(gpsCircle);
    }
}

// Método responsável por adicionar a localização no mapa ao encontrar.
function onLocateFound(e) {

    let radius = e.accuracy;
    gpsCircle = L.circle((e.latlng), radius, { color: 'red' }).addTo(worldMap).bindPopup(`<kbd><b>Your Location</b></kbd></br><br>Position through your GPS:</br>Latitude: ${e.latlng.lat.toFixed(3)}</br>Longitude: ${e.latlng.lng.toFixed(3)}`);
}

// Método responsável por atualizar a posição da ISS.
function updateIss(lat, lng) {

    if (!issMarker) {
        issMarker = L.marker([lat, lng], { icon: issMarkerIcon }).addTo(worldMap).bindPopup("<kbd><b>ISS Position</b></kbd></br><br>Current position of the ISS</br>");
        worldMap.setView([lat, lng], worldMap.getZoom());
        calcOrbitPath();
    }

    issMarker.setLatLng(L.latLng(lat, lng)).bindPopup("<kbd><b>ISS Position</b></kbd></br><br>Current position of the ISS</br>");

    // Atualizando a passagem órbita da ISS.
    if(issPath) {
        updateOrbitPass(lng);
    }
}

// Método responsável pela atualização da área de visibilidade da ISS.
function updateIssFootprint(lat, lng, alt) {

    // Calculando a área visível da Terra através da altura da ISS.
    // A = 2.π.h.R²/(h+R)
    let area = (2 * Math.PI * (alt / 1.609) * (3963 * 3963)) / ((alt / 1.609) + 3963);

    // Calculando o raio do círculo através da área.
    // r = √A/π
    let radius = Math.sqrt((area * 2589988.110336) / Math.PI);

    if (!issFootprint) {
        issFootprint = L.circle([lat, lng], radius, {color: 'white', opacity: .100, fillColor: 'red', fillOpacity: .2}).addTo(worldMap);
    }

    issFootprint.setLatLng(L.latLng(lat, lng));
    issFootprint.setRadius(radius);
}

// Método responsável por atualizar a posição do Sol.
function updateSun(lat, lng) {

    if (!sunMarker) {
        sunMarker = L.marker([lat, lng], {icon: sunMarkerIcon}).addTo(worldMap).bindPopup("<kbd><b>Sun Position</b></kbd></br><br>Current position of the sun</br>");
    }

    // Resolvendo condição na qual a longitude ultrapassa 180 graus e atualizando a posição do sol no mapa.
    sunMarker.setLatLng(L.latLng(lat, lng > 180 ? lng - 360 : lng));
}

// Método responsável por atualizar o painel de dados da ISS.
function updateDataPanel(data) {

    let imgVisibility = document.getElementById('imgVisibility');

    let visibility = '';

    if (data.visibility == 'daylight') {
        imgVisibility.src = 'img/sunVisi.ico';
        visibility = 'Daylight';
    } else {
        imgVisibility.src = 'img/moonVisi.ico';
        visibility = 'Eclipsed';
    }

    document.getElementById('parLatitude').innerHTML = `${data.latitude.toFixed(3)}°`;
    document.getElementById('parLongitude').innerHTML = `${data.longitude.toFixed(3)}°`;
    document.getElementById('parAltitude').innerHTML = `${data.altitude.toFixed(3)} Km`;
    document.getElementById('parVelocity').innerHTML = `${data.velocity.toFixed(3)} Km/h`;
    document.getElementById('parVisibility').innerHTML = visibility;
}

// Método responsável por pegar os dados.
function getData(URL, method, callback, callbackError) {

    fetch(URL, {method}).then(response => {

        if(response.status === 200) {
            response.json().then(data => callback(data));
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }

    }).catch(error => callbackError(error));

}

// Método responsável pela sobreposição de dia/noite no mapa.
function overlayDayNight() {

    let terminatorUpdate = L.terminator();
    terminator.setLatLngs(terminatorUpdate.getLatLngs());
    terminator.redraw();
    setTimeout(overlayDayNight, 1500);
}

// Método responsável por calcular futuras timestamps.
function calcTimestamps(timestamp, value) {

    let timestamps = timestamp + ",";

    for (i = 1; i <= 9; i++) {
        
        let add = timestamp + (value * i);

        i != 9 ? timestamps += add + ',' : timestamps += add;
    }
    return timestamps;
}

// Método responsável por calcular a órbita da ISS e adicionar ao mapa.
function calcOrbitPath(timestamp = data.timestamp) {

    if (window.document.getElementById('chkCalcOrbit').checked) {

        if (!issPath) {
            
            issPath = L.layerGroup();

            let timestamps = calcTimestamps(timestamp, 700);

            getData(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${timestamps}&units=kilometers`, 'GET', function (data) {
                let orbit = Array();

                // Laço responsável por converter as coordenadas geográficas para latLang e adiconar no array de órbita.
                for (i = 0; i < data.length; i++) {
                    orbit.push(L.latLng(data[i].latitude, data[i].longitude));
                }
   
                // Laço responsável por alimentar o array de órbita com os pontos médios geográficos.
                for (let i = 0; i < 6; i++) {
                    
                    // Array de pontos médios
                    let array = calcMiddlePoints(orbit);

                    // Adicionando os pontos médios ao array de órbita.
                    for (let x = 0; x < array.length; x++) {
                        orbit[x] = array[x];
                    }
                }
                
                // Criando Layers e adicionando os pontos de órbita no mapa.
                orbit.forEach(point => issPath.addLayer(L.circle(point, {color: 'yellow', opacity: 0.5})));

                issPath.addTo(worldMap);
            });
        } else {
            issPath.addTo(worldMap);
        }

    } else {
        issPath.removeFrom(worldMap);
    }
}

// Método responsável por marcar os pontos geográficos por onde a ISS já passou e atualizá-los.
function updateOrbitPass(lng) {

    for (i = 0; i <= issPath.getLayers().length-1; i++) {

        const orbLon = issPath.getLayers()[i]._latlng.lng;
        const issLon = lng;
            
        if (Math.abs((orbLon) - (issLon)) <= 0.2) {
            
            issPath.getLayers()[i].setStyle({color: '#D3D3D3'});

            // Atualizando o rumo da ISS.
            if (i < issPath.getLayers().length-1) {
                issBearing(issPath.getLayers()[i]._latlng, issPath.getLayers()[i+1]._latlng);
            }

            // Atualizando o caminho da órbita da ISS.
            if (i == issPath.getLayers().length-1) {
                updateOrbitPath();
            }

        }
    
    }
}

// Método responsável por atualizar a órbita da ISS.
function updateOrbitPath() {
    
    issPath.removeFrom(worldMap);
    issPath = undefined;
    calcOrbitPath();
}

// Método responsável por converter valor para radianos.
function toRad(n) {

    return n * Math.PI / 180;
}

// Método responsável por converter valor para graus.
function toDeg(n) {
    
    return n * 180 / Math.PI;
}

// Método responsável por calcular o rumo da ISS.
function issBearing(p1,p2) {

    /* ======================================================================

    Calculando o rumo(bearing) da ISS através de dois pontos geográficos.

    Fórmula matemática:

    θ = atan2(sin Δλ ⋅ cos φ2 , cos φ1 ⋅ sin φ2 − sin φ1 ⋅ cos φ2 ⋅ cos Δλ)

    Onde:

    θ     - Coeficiente angular
    sin   - Seno
    cos   - Coseno
    Δλ    - Diferença entre longitudes
    φ1    - Latitude inicial
    φ2    - Latitude final
    λ1    - Longitude inicial
    λ2    - Longitude final
    atan2 - retorna arco tangente

    ======================================================================== */

    // Convertendo coordenadas de graus para radianos.
    let φ1 = toRad(p1.lat);
    let λ1 = toRad(p1.lng);
    let φ2 = toRad(p2.lat);
    let λ2 = toRad(p2.lng);

    const Δλ = λ2 - λ1 ;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    // Convertendo de radianos para graus.
    let θ = (toDeg(Math.atan2(y, x)) + 360) % 360;

    // Atualizando o rumo da ISS.
    issMarker._icon.innerHTML = 
    `<img width="50" height="38" src="img/issMarkerIcon.svg"
    style="-webkit-transform: rotate(${θ}deg);
    -moz-transform: rotate(${θ}deg);
    -webkit-backface-visibility: hidden;" />`;
}

// Método responsável por calcular o ponto médio entre coordenadas geográficas.
function calcMiddlePoints(array) {

    let middlePoints = Array();

    for (let i = 0; i < array.length - 1; i++) {

        /* ======================================================================

        Calculando o ponto médio entre dois pontos geográficos.

        Fórmulas matemáticas:

        Bx = cos φ2 ⋅ cos Δλ
        By = cos φ2 ⋅ sin Δλ
        φm = atan2(sin φ1 + sin φ2, √(cos φ1 + Bx)² + By²)
        λm = λ1 + atan2(By, cos(φ1)+Bx)

        Onde:

        sin   - Seno
        cos   - Coseno
        Δλ    - Diferença entre longitudes
        φ1    - Latitude inicial
        φ2    - Latitude final
        λ1    - Longitude inicial
        λ2    - Longitude final
        φm    - Latitude média
        λm    - Longitude média
        atan2 - retorna arco tangente

        ======================================================================== */

        // Convertendo coordenadas de graus para radianos.
        let φ1 = toRad(array[i].lat);
        let λ1 = toRad(array[i].lng);
        let φ2 = toRad(array[i + 1].lat);
        let λ2 = toRad(array[i + 1].lng);

        const Δλ = λ2 - λ1;
        const Bx = Math.cos(φ2) * Math.cos(Δλ);
        const By = Math.cos(φ2) * Math.sin(Δλ);

        // Convertendo coordenadas de radianos para graus.
        let φm = toDeg(Math.atan2(Math.sin(φ1)+Math.sin(φ2), Math.sqrt((Math.cos(φ1)+Bx)*(Math.cos(φ1)+Bx) + By*By)));
        let λm = toDeg(λ1 + Math.atan2(By, Math.cos(φ1) + Bx));

        middlePoints.push(array[i]);
        
        // Alimentando Array de pontos médios e resolvendo condição na qual a longitude ultrapassa 180 graus.
        middlePoints.push(L.latLng(φm, λm > 180 ? λm - 360 : λm));
    }

    return middlePoints;
}