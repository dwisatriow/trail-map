require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/widgets/Search",
  "esri/widgets/FeatureTable",
  "esri/core/watchUtils",
  "esri/widgets/BasemapToggle",
], function (
  esriConfig,
  Map,
  MapView,
  FeatureLayer,
  Search,
  FeatureTable,
  watchUtils,
  BasemapToggle
) {
  esriConfig.apiKey =
    "AAPKaef733abbfe34f2a91b9796c1cdc137eYJM_M9dzy84QG3ujb9Yz0hotBBB5yqyJLLfUDMO2U3jmr3c0ZNxhjc5FrZMFU_qO";

  // BASEMAP
  const map = new Map({
    basemap: "arcgis-topographic", // Basemap layer service
    // basemap: "arcgis-navigation",
  });

  const view = new MapView({
    map: map,
    center: [-118.805, 34.027], // Longitude, latitude
    zoom: 13, // Zoom level
    container: "viewDiv", // Div element
  });

  // POP-UP
  // Define a pop-up for Trailheads
  const popupTrailheads = {
    title: "Trailhead",
    content:
      "<b>Trail:</b> {TRL_NAME}<br><b>City:</b> {CITY_JUR}<br><b>Cross Street:</b> {X_STREET}<br><b>Parking:</b> {PARKING}<br><b>Elevation:</b> {ELEV_FT} ft",
  };

  const trailheads = new FeatureLayer({
    url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads_Styled/FeatureServer/0",
    outFields: ["TRL_NAME", "CITY_JUR", "X_STREET", "PARKING", "ELEV_FT"],
    popupTemplate: popupTrailheads,
  });

  map.add(trailheads);

  // SEARCH
  const search = new Search({
    //Add Search widget
    view: view,
  });

  view.ui.add(search, "top-right"); //Add to the map

  // FEATURE TABLE
  //Trails feature layer (lines)
  const trailsLayer = new FeatureLayer({
    url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails_Styled/FeatureServer/0",
  });

  map.add(trailsLayer, 0);

  // Specify featureLayer for featureTable
  const featureLayer = map.layers.getItemAt(0);
  featureLayer.title = "Trails in Mahou Riviera";

  // Create the feature table
  const featureTable = new FeatureTable({
    layer: trailsLayer,
    view: view, // required for feature highlight to work
    // autocastable to FieldColumnConfig
    fieldConfigs: [
      {
        name: "TRL_NAME",
        label: "Trail",
      },
      {
        name: "ELEV_MIN",
        label: "Minimum Elevation",
      },
      {
        name: "ELEV_MAX",
        label: "Maximum Elevation",
      },
      {
        name: "ELEV_GAIN",
        label: "Elevation Gain",
      },
      {
        name: "LENGTH_FT",
        label: "Length (ft)",
      },
      {
        name: "LENGTH_MI",
        label: "Length (mi)",
      },
    ],
    container: "tableDiv",
  });

  // Add buttons to the mapView
  view.ui.add(document.getElementById("actions"), "top-right");

  // Listen for the table's selection-change event
  let features = [];

  featureTable.on("selection-change", (changes) => {
    // If the selection is removed, remove the feature from the array
    changes.removed.forEach((item) => {
      const data = features.find((data) => {
        return data.feature === item.feature;
      });
      if (data) {
        features.splice(features.indexOf(data), 1);
      }
    });
    // If the selection is added, push all added selections to array
    changes.added.forEach((item) => {
      const feature = item.feature;
      features.push({
        feature: feature,
      });
    });
    console.log(features);
  });

  // Filter table when view extent change
  featureLayer.watch("loaded", () => {
    watchUtils.whenFalse(view, "updating", () => {
      // Get the new extent of view/map whenever map is updated.
      if (view.extent) {
        // Filter and show only the visible features in the feature table
        featureTable.filterGeometry = view.extent;
      }
    });
  });

  // Listen for the click on the view and select any associated row in the table
  view.on("immediate-click", (event) => {
    view.hitTest(event).then((response) => {
      const candidate = response.results.find((result) => {
        return (
          result.graphic &&
          result.graphic.layer &&
          result.graphic.layer === featureLayer
        );
      });
      // Select the rows of the clicked feature
      candidate && featureTable.selectRows(candidate.graphic);
    });
  });

  const zoomBtn = document.getElementById("zoom");
  const fullExtentBtn = document.getElementById("fullextent");

  // Wire up button click event listeners
  zoomBtn.addEventListener("click", zoomToSelectedFeature);
  fullExtentBtn.addEventListener("click", fullExtent);

  // fires when "Zoom to selected feature(s)" button is clicked
  function zoomToSelectedFeature() {
    // Create a query off of the feature layer
    const query = featureLayer.createQuery();
    // Iterate through the features and grab the feature's objectID
    const featureIds = features.map((result) => {
      return result.feature.getAttribute(featureLayer.objectIdField);
    });
    // Set the query's objectId
    query.objectIds = featureIds;
    // Make sure to return the geometry to zoom to
    query.returnGeometry = true;
    // Call queryFeatures on the feature layer and zoom to the resulting features
    featureLayer.queryFeatures(query).then((results) => {
      view.goTo(results.features).catch((error) => {
        if (error.name != "AbortError") {
          console.error(error);
        }
      });
    });
  }
  // Fires when "Full extent" button is clicked
  function fullExtent() {
    // Zooms to the full extent of the feature layer
    view.goTo(featureLayer.fullExtent).catch((error) => {
      if (error.name != "AbortError") {
        console.error(error);
      }
    });
  }

  // Toggle between basemaps
  const basemapToggle = new BasemapToggle({
    view: view,
    nextBasemap: "arcgis-navigation",
  });

  view.ui.add(basemapToggle, "bottom-right");

  // Get references to div elements for toggling table visibility
  const body = document.querySelector("body");
  const tableContainer = document.getElementById("tableContainer");

  // Add toggle visibility slider
  view.ui.add(document.getElementById("toggleDiv"), "bottom-left");

  // Get reference to div elements
  const checkboxEle = document.getElementById("checkboxId");
  const labelText = document.getElementById("labelText");

  // Listen for when toggle is changed, call toggleFeatureTable function
  checkboxEle.onchange = function () {
    toggleFeatureTable();
  };

  function toggleFeatureTable() {
    console.log(body);
    // Check if the table is displayed, if so, toggle off. If not, display.
    if (!checkboxEle.checked) {
      body.removeChild(tableContainer);
      labelText.innerHTML = "Show Feature Table";
    } else {
      body.appendChild(tableContainer);
      labelText.innerHTML = "Hide Feature Table";
    }
  }
});
