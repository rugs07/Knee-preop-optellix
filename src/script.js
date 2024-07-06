import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GUI } from "dat.gui";

let container, scene, camera, renderer, controls;
let femur, tibia;
const landmarks = [];
const planes = [];
let selectedLandmark = null;

document.addEventListener("DOMContentLoaded", () => {
  init();
  animate();
});

function init() {
  container = document.getElementById("container");

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

  // Camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.z = 5;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);

  // Load STL Files
  const loader = new STLLoader();
  loader.load(
    "/models/Right_Femur.stl",
    (geometry) => {
      console.log("Model loaded");
      const material = new THREE.MeshPhongMaterial({
        color: 0xff5573,
        specular: 0x111111,
        shininess: 200,
      });
      femur = new THREE.Mesh(geometry, material);
      // femur.scale.set(10,10,10)
    //   femur.position.set(0, 0, 0);
      scene.add(femur);
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    (error) => {
      console.log(error);
    }
  );

  loader.load("/models/Right_Tibia.stl", (geometry) => {
    const material = new THREE.MeshPhongMaterial({
      color: 0x33ff55,
      specular: 0x111111,
      shininess: 200,
    });
    tibia = new THREE.Mesh(geometry, material);
    // tibia.position.set(0, 0, 0);
    scene.add(tibia);
  });

  // Landmark button handling
  const buttonContainer = document.createElement("div");
  buttonContainer.style.position = "absolute";
  buttonContainer.style.top = "10px";
  buttonContainer.style.left = "10px";
  document.body.appendChild(buttonContainer);

  const landmarksList = [
    "Femur Center",
    "Hip Center",
    "Femur Proximal Canal",
    "Femur Distal Canal",
    "Medial Epicondyle",
    "Lateral Epicondyle",
    "Distal Medial Point",
    "Distal Lateral Point",
    "Posterior Medial Point",
    "Posterior Lateral Point",
  ];

  landmarksList.forEach((name) => {
    const button = document.createElement("button");
    button.textContent = name;
    button.onclick = () => selectLandmark(name);
    buttonContainer.appendChild(button);
  });

  // Raycaster for detecting clicks
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  container.addEventListener("click", onClick);

  function onClick(event) {
    if (!selectedLandmark) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects([femur, tibia]);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      addLandmark(intersect.point);
    }
  }

  function addLandmark(position) {
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const landmark = new THREE.Mesh(geometry, material);
    landmark.position.copy(position);
    scene.add(landmark);

    landmarks.push({ name: selectedLandmark, object: landmark });
    selectedLandmark = null;
  }

  // Update button functionality
  const updateButton = document.createElement("button");
  updateButton.textContent = "Update Axes";
  updateButton.onclick = createAxesAndPlanes;
  buttonContainer.appendChild(updateButton);

  // Plane button functionality
  const planeButton = document.createElement("button");
  planeButton.textContent = "Create Perpendicular Plane";
  planeButton.onclick = createPerpendicularPlane;
  buttonContainer.appendChild(planeButton);

  // GUI for interactive controls
  const gui = new GUI();
  const params = {
    varusValgus: 0,
    flexionExtension: 0,
    update: function () {
      updatePlanes();
    },
  };

  gui
    .add(params, "varusValgus", -10, 10)
    .name("Varus/Valgus (°)")
    .onChange(params.update);
  gui
    .add(params, "flexionExtension", -10, 10)
    .name("Flexion/Extension (°)")
    .onChange(params.update);

  const resectionParams = {
    showResection: true,
  };

  gui
    .add(resectionParams, "showResection")
    .name("Toggle Resection")
    .onChange(() => {
    });

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function selectLandmark(name) {
  selectedLandmark = name;
}

function createAxesAndPlanes() {
  const hipCenter = landmarks.find((l) => l.name === "Hip Center");
  const femurCenter = landmarks.find((l) => l.name === "Femur Center");

  if (hipCenter && femurCenter) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      hipCenter.object.position,
      femurCenter.object.position,
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    planes.push(line);
  }
}

function createPlane(normal, point, size) {
  const planeGeometry = new THREE.PlaneGeometry(size, size);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  plane.applyQuaternion(quaternion);

  plane.position.copy(point);

  return plane;
}

function createPerpendicularPlane() {
  const femurCenter = landmarks.find((l) => l.name === "Femur Center");
  const hipCenter = landmarks.find((l) => l.name === "Hip Center");

  if (femurCenter && hipCenter) {
    const mechanicalAxis = new THREE.Vector3()
      .subVectors(hipCenter.object.position, femurCenter.object.position)
      .normalize();
    const plane = createPlane(mechanicalAxis, femurCenter.object.position, 100);
    scene.add(plane);
    planes.push(plane);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
