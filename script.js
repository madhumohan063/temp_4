let map; 
let directionsService;
let currentLocation;
let routeRenderers = []; // To store multiple DirectionsRenderer instances
let routeLabels = []; // To store route labels
let currentWeatherInfoWindow = null; // Track the current weather info window

const openWeatherAPIKey = '9743c676f0895b4b3e2272c45e7dc45d'; // OpenWeatherMap API key

// Initialize the Google Map
// Initialize the autocomplete for source and destination fields
function initAutocomplete() {
  const sourceInput = document.getElementById('source');
  const destinationInput = document.getElementById('destination');

  // Create the autocomplete object, restricting the search predictions to geographical location types.
  const autocompleteSource = new google.maps.places.Autocomplete(sourceInput, {
    types: ['geocode'], // You can restrict this to 'cities' or specific places if needed
  });

  const autocompleteDestination = new google.maps.places.Autocomplete(destinationInput, {
    types: ['geocode'],
  });

  // Bias the autocomplete object to the user's current geographical location.
  if (currentLocation) {
    const bounds = new google.maps.LatLngBounds(currentLocation);
    autocompleteSource.setBounds(bounds);
    autocompleteDestination.setBounds(bounds);
  }
}

// Call initAutocomplete() within initMap()
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 8,
    center: { lat: 17.6411, lng: 78.4952 }, // Centered in Hyderabad, India
    zoomControl: false, // Disable the zoom control buttons
    scrollwheel: true, // Enable scrolling to zoom
  });

  directionsService = new google.maps.DirectionsService();

  // Get the user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      map.setCenter(currentLocation);
      new google.maps.Marker({
        position: currentLocation,
        map: map,
        title: "Your location",
      });

      // Initialize autocomplete after getting the user's location
      initAutocomplete();
    });
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}



// Fetch weather data using OpenWeatherMap API
function getWeather(lat, lng, mapPosition, label = "Weather") {
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${openWeatherAPIKey}&units=metric`;

  axios.get(weatherUrl)
    .then(response => {
      const weather = response.data;
      const iconCode = weather.weather[0].icon;  // Get the weather icon code
      const iconUrl = `http://openweathermap.org/img/w/${iconCode}.png`;  // Construct the icon URL
      const weatherDescription = weather.weather[0].description;  // Get weather description
      const temperature = weather.main.temp; // Get temperature

      // Use reverse geocoding to get a more specific address
      const geocoder = new google.maps.Geocoder();
      const latLng = { lat: lat, lng: lng };

      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK") {
          if (results[0]) {
            let areaName = null;
            results[0].address_components.forEach(component => {
              if (component.types.includes("sublocality_level_1") || component.types.includes("locality")) {
                areaName = component.long_name;
              }
            });

            if (!areaName) {
              areaName = results[0].address_components.find(comp => comp.types.includes("administrative_area_level_2")).long_name;
            }

            const weatherSearchUrl = `https://www.google.com/search?q=weather+in+${areaName}`;

            const weatherContent = `
              <div style="display: flex; align-items: center; padding: 2px; margin: 0; width: 150px;">
                <a href="${weatherSearchUrl}" target="_blank" style="text-decoration: none; color: black;">
                  <img src="${iconUrl}" alt="${weatherDescription}" style="width: 50px; height: 50px;">
                  <span style="margin-left: 5px; font-size: 16px; line-height: 1.2;">
                    <strong>${label}</strong>: ${weatherDescription} (${temperature}°C)
                  </span>
                </a>
              </div>
            `;

            if (currentWeatherInfoWindow) {
              currentWeatherInfoWindow.close();
            }

            currentWeatherInfoWindow = new google.maps.InfoWindow({
              content: weatherContent,
              position: mapPosition,
            });

            currentWeatherInfoWindow.open(map);
          } else {
            console.error("No results found for reverse geocoding.");
          }
        } else {
          console.error("Geocoder failed due to: " + status);
        }
      });

    })
    .catch(error => {
      console.error('Error fetching weather data:', error);
      document.getElementById('weather').textContent = 'Weather information not available.';
    });
}

// Calculate and display routes
function calculateRoute() {
  const source = document.getElementById('source').value;
  const destination = document.getElementById('destination').value;
  const waypointsInput = document.getElementById('waypoints').value; // Get waypoints input
  const mode = document.getElementById('mode').value;
  const useCurrentLocation = document.getElementById('useCurrentLocation').checked;

  if (!destination) {
    alert("Please enter a destination.");
    return;
  }

  // Prepare waypoints
  const waypoints = [];
  if (waypointsInput) {
    const waypointArray = waypointsInput.split(',').map(waypoint => waypoint.trim());
    for (let waypoint of waypointArray) {
      waypoints.push({ location: waypoint, stopover: true });
    }
  }

  // Use current location if checkbox is selected or no source is provided
  if (useCurrentLocation) {
    if (currentLocation) {
      requestRoute(currentLocation, destination, mode, waypoints);
    } else {
      alert("Current location not found.");
    }
  } else if (source) {
    // Use Google Maps Geocoder to convert the source address to coordinates
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': source }, (results, status) => {
      if (status === 'OK') {
        const sourceLocation = results[0].geometry.location;
        requestRoute(sourceLocation, destination, mode, waypoints);
      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    });
  } else {
    alert("Please enter a source location or check the current location option.");
  }
}



// Function to make a directions request and render the route
function requestRoute(sourceLocation, destination, mode, waypoints) {
  const request = {
    origin: sourceLocation,
    destination: destination,
    waypoints: waypoints, // Add waypoints to the request
    travelMode: google.maps.TravelMode[mode],
    provideRouteAlternatives: true,
  };

  if (mode === 'DRIVING') {
    request.drivingOptions = {
      departureTime: new Date(), // Current time for live traffic info
      trafficModel: 'bestguess',
    };
  }

  directionsService.route(request, (response, status) => {
    if (status === 'OK') {
      const routes = response.routes;
      const routeCount = Math.min(routes.length, 4); // Limit to 4 routes

      // Clear previous renderers and labels
      clearRoutesAndLabels();

      if (routeCount === 1) {
        alert("Only one route is available.");
        renderRoute(response, 0); // Display the single route
        return;
      }

      // Display up to 4 routes, all in blue
      for (let i = 0; i < routeCount; i++) {
        renderRoute(response, i);
      }

      // Get weather data for the destination after routes are rendered
      const destinationLatLng = routes[0].legs[0].end_location;
      getWeather(destinationLatLng.lat(), destinationLatLng.lng(), destinationLatLng, "Destination Weather");

    } else {
      alert('Directions request failed due to ' + status);
    }
  });
}


// Clear previous routes and labels
function clearRoutesAndLabels() {
  routeRenderers.forEach(renderer => renderer.setMap(null));
  routeLabels.forEach(label => label.setMap(null));
  routeRenderers = [];
  routeLabels = [];
  clearRouteInfo();
}

// Render a specific route, all in blue, and add route label
function renderRoute(response, routeIndex) {
  const route = response.routes[routeIndex];
  const routePath = route.overview_path;

  const routeRenderer = new google.maps.DirectionsRenderer({
    map: map,
    directions: response,
    routeIndex: routeIndex,
    polylineOptions: {
      strokeColor: '#0000FF', // Blue color for all routes
      strokeOpacity: 0.9,
      strokeWeight: 5,
    },
    suppressMarkers: false,
    clickable: true,
  });

  google.maps.event.addListener(routeRenderer, 'click', () => {
    selectRoute(response, routeIndex);
  });

  routeRenderers.push(routeRenderer);

  const routeLabel = String.fromCharCode(65 + routeIndex);
  const routeMidpoint = getRouteMidpoint(routePath);

  const labelMarker = new google.maps.Marker({
    position: routeMidpoint,
    map: map,
    label: routeLabel,
    clickable: true,
  });

  labelMarker.addListener('click', () => {
    selectRoute(response, routeIndex);
  });

  routeLabels.push(labelMarker);
}

// Select and display only the chosen route, and show distance, duration, and weather at the midpoint
function selectRoute(response, selectedRouteIndex) {
  routeRenderers.forEach((renderer, routeIndex) => {
    if (routeIndex === selectedRouteIndex) {
      renderer.setOptions({
        polylineOptions: {
          strokeColor: '#0000FF', // Blue color for the selected route
          strokeOpacity: 0.9,
          strokeWeight: 7, // Thicker line for the selected route
        },
        map: map,
      });
    } else {
      renderer.setOptions({
        polylineOptions: {
          strokeColor: '#cdd8ff', // Light blue for non-selected routes
          strokeOpacity: 0.7,
          strokeWeight: 5, // Thinner line for non-selected routes
        },
        map: map,
      });
    }
  });

  const route = response.routes[selectedRouteIndex].legs[0];
  displayRouteInfo(route, selectedRouteIndex);

  const routeMidpoint = getRouteMidpoint(response.routes[selectedRouteIndex].overview_path);

  getWeather(routeMidpoint.lat(), routeMidpoint.lng(), routeMidpoint);
}

function getRouteMidpoint(path) {
  const midpointIndex = Math.floor(path.length / 2);
  return path[midpointIndex];
}

function displayRouteInfo(route, index) {
  const routeLabel = String.fromCharCode(65 + index);
  const distance = route.distance.text;
  const duration = route.duration.text;

  document.getElementById('distance').textContent = `Route ${routeLabel} Distance: ${distance}`;
  document.getElementById('duration').textContent = `Route ${routeLabel} Duration: ${duration}`;
}

function clearRouteInfo() {
  document.getElementById('distance').textContent = '';
  document.getElementById('duration').textContent = '';
}


