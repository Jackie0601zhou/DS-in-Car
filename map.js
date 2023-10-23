
document.addEventListener("DOMContentLoaded", function() {
    var map;
var directionsService;
var directionsRenderer;
var userMarker;
var carIcon = { url: 'car.png'};
var waypoints = [];
var lastSelectedDestination = null;
var userCurrentLocation = null;



function initMapWithCenter(center) {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();

    map = new google.maps.Map(document.getElementById('map-api'), {
        center: center,
        zoom: 13,
        disableDefaultUI: true,
        mapTypeControl: false,
        clickableIcons: false,
    });

    directionsRenderer.setMap(map);

    var input = document.getElementById('autocomplete-input');
    var autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (place.geometry) {
        lastSelectedDestination = place.geometry.location;  // 更新目的地
        calculateAndDisplayRoute(userCurrentLocation, lastSelectedDestination, waypoints);
    }
});


    var waypointInput = document.getElementById('waypoint');
var waypointAutocomplete = new google.maps.places.Autocomplete(waypointInput);
waypointAutocomplete.addListener('place_changed', function() {
    var place = waypointAutocomplete.getPlace();
    if (place.geometry) {
        waypoints.push({
            location: place.geometry.location,
            stopover: true
        });
        // 如果我们有最后选定的目的地，重新计算路线
        if (lastSelectedDestination) {
            calculateAndDisplayRoute(userCurrentLocation, lastSelectedDestination, waypoints);
        }
        waypointInput.value = '';  // 清除输入框内容
    }
});


    map.addListener('bounds_changed', function() {
        var bounds = map.getBounds();
        autocomplete.setBounds(bounds);
        waypointAutocomplete.setBounds(bounds);
    });
    map.addListener('click', function(e) {
        console.log('Map clicked at:', e.latLng);
        // 在地图上点击时，重新计算路线，以新的点击位置作为目的地
        calculateAndDisplayRoute(userCurrentLocation, e.latLng, waypoints);
    });
    
    
    // Watch the user's position
    watchUserPosition();
    document.getElementById('next-step').style.display = 'none';
}
window.initMap = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            initMapWithCenter(pos);
        }, function() {
            initMapWithCenter({lat: 57.7089, lng: 11.9746});  // 默认为哥德堡
        });
    } else {
        initMapWithCenter({lat: 57.7089, lng: 11.9746});  // 浏览器不支持地理定位，使用哥德堡作为默认位置
    }
}
initMap();

function calculateAndDisplayRoute(start, end, Waypoints) {
    var request = {
        origin: start,
        destination: end,
        waypoints: Waypoints,
        optimizeWaypoints: true,
        travelMode: 'DRIVING'
    };

    // Check if user wants to avoid highways
    if (document.getElementById('avoid-highways').checked) {
        request.avoidHighways = true;
    }

    // Check if user wants to avoid tolls
    if (document.getElementById('avoid-tolls').checked) {
        request.avoidTolls = true;
    }

    directionsService.route(request, function(response, status) {
        if (status === 'OK') {
            directionsRenderer.setDirections(response);
            if (userMarker) {
                userMarker.setMap(map);  // 重新渲染用户标记
            }
            if (response.routes[0] && response.routes[0].legs[0] && response.routes[0].legs[0].steps[0]) {
                var firstStep = response.routes[0].legs[0].steps[0].instructions;
                // 显示在你的界面上
                document.getElementById('next-step').innerHTML = firstStep;
                // 显示next-step元素
                document.getElementById('next-step').style.display = 'block';
            } else {
                // 如果没有得到期望的路线信息，隐藏next-step元素
                document.getElementById('next-step').style.display = 'none';
            }
        } else {
            console.error('Directions request failed due to ' + status);
        }
    });
}

function navigateUsingPlaceName(startName, endName, stopoverName) {
    var service = new google.maps.places.PlacesService(map);
    var startLatLng, endLatLng, stopoverLatLng;
    var waypoints = []; // 初始化为空数组

    service.findPlaceFromQuery({
        query: startName,
        fields: ['geometry']
    }, function(results, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            startLatLng = results[0].geometry.location;
            
            service.findPlaceFromQuery({
                query: endName,
                fields: ['geometry']
            }, function(results, status) {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    endLatLng = results[0].geometry.location;
                    
                    if (stopoverName) {
                        // 如果提供了stopover，则查询其经纬度
                        service.findPlaceFromQuery({
                            query: stopoverName,
                            fields: ['geometry']
                        }, function(results, status) {
                            if (status === google.maps.places.PlacesServiceStatus.OK) {
                                stopoverLatLng = results[0].geometry.location;
                                waypoints.push({
                                    location: stopoverLatLng,
                                    stopover: true
                                });
                                calculateAndDisplayRoute(startLatLng, endLatLng, waypoints);
                            }
                        });
                    } else {
                        // 如果没有提供stopover，直接进行导航
                        calculateAndDisplayRoute(startLatLng, endLatLng, waypoints);
                    }
                }
            });
        }
    });
}



function watchUserPosition() {
    navigator.geolocation.watchPosition(function(position) {
        var currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        userCurrentLocation = currentLocation;

        if (!userMarker) {
            userMarker = new google.maps.Marker({
                position: currentLocation,
                map: map,
                zIndex: 9999, 
                icon: carIcon,
            });
        } else {
            userMarker.setPosition(currentLocation);
        }
        console.log("Current Location: ", currentLocation);
    }, function(error) {
        console.error("Error occurred: " + error.message);
    }, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000
    });
}


window.initMap = function() {
    console.log("initMap called");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            initMapWithCenter(pos);
        }, function() {
            initMapWithCenter({lat: 57.7089, lng: 11.9746});  // 默认为哥德堡
        });
    } else {
        initMapWithCenter({lat: 57.7089, lng: 11.9746});  // 浏览器不支持地理定位，使用哥德堡作为默认位置
    }
    
}
document.getElementById('close-btn').addEventListener('click', function() {
    // 清除输入
    document.getElementById('autocomplete-input').value = '';

    // 退出导航
    if(directionsRenderer) {
        directionsRenderer.setDirections({routes: []});
    }

    // 隐藏"下一步"提示
    document.getElementById('next-step').innerText = '';
    document.getElementById('next-step').style.display = 'none';  // 隐藏next-step框
});

document.getElementById('preferences-toggle-btn').addEventListener('click', function() {
    var container = document.getElementById('preferences-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
});
document.getElementById('avoid-highways').addEventListener('change', function() {
    if (lastSelectedDestination) {
        calculateAndDisplayRoute(userCurrentLocation, lastSelectedDestination, waypoints);
    }
});

document.getElementById('avoid-tolls').addEventListener('change', function() {
    if (lastSelectedDestination) {
        calculateAndDisplayRoute(userCurrentLocation, lastSelectedDestination, waypoints);
    }
});




window.calculateAndDisplayRoute = calculateAndDisplayRoute;
window.navigateUsingPlaceName = navigateUsingPlaceName;
})


