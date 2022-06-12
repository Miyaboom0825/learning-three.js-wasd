import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";

export default function Canvas() {
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // キャンバスサイズを指定
    const width = 960;
    const hight = 540;

    // レンダラーを作成
    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, hight);

    // レンダラー：シャドウを有効にする
    renderer.shadowMap.enabled = true;

    const elm = ref.current;
    elm?.appendChild(renderer.domElement);

    // シーンを作成
    const scene = new THREE.Scene();

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;
    let canJump = false;

    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const vertex = new THREE.Vector3();

    // カメラを作成 THREE.PerspectiveCamera(画角, アスペクト比, 描画開始距離, 描画終了距離)
    const camera = new THREE.PerspectiveCamera(45, width / hight, 1, 10000);
    // カメラコントローラーを作成
    const controls = new PointerLockControls(camera, document.body);
    camera.position.set(0, 10, 50);
    const menu = menuRef.current;
    const startButton = startButtonRef.current;
    if (startButton) {
      startButton.addEventListener(
        "click",
        () => {
          controls.lock();
        },
        false
      );
    }
    if (menu) {
      controls.addEventListener("lock", () => (menu.style.display = "none"));
      controls.addEventListener("unlock", () => (menu.style.display = "flex"));
    }

    // 平行光源を作成
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(10, 30, 10);
    scene.add(directionalLight);
    // 影を有効にする
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0;
    directionalLight.shadow.camera.far = 60;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.top = -10;
    directionalLight.shadow.camera.bottom = 10;
    scene.add(directionalLight);
    directionalLight.target.position.set(0, 15, 0);
    scene.add(directionalLight.target);

    // シャドウカメラヘルパーを作成シャドウカメラヘルパーを作成
    // const helper = new THREE.CameraHelper(directionalLight.shadow.camera);
    // scene.add(helper);

    // 環境光源を作成
    // new THREE.AmbientLight(色, 光の強さ)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // 箱を作成
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(0, 15, 0);
    scene.add(box);
    // 影を落とす
    box.castShadow = true;
    scene.add(box);

    // 床を作成
    const floorGeo = new THREE.PlaneGeometry(2000, 2000);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: {
        floorColor: { value: new THREE.Color(0xffffff) },
        gridColor: { value: new THREE.Color(0xcccccc) },
        divisions: { value: 100.0 },
        thickness: { value: 0.01 }
      },
      vertexShader: `
      varying vec2 vUv;

			void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vec4 mvPosition =  viewMatrix * worldPosition;
        vUv = uv;
        gl_Position = projectionMatrix * mvPosition;
			}
      `,
      fragmentShader: `
      uniform vec3 floorColor;
      uniform vec3 gridColor;
      uniform float divisions;
      uniform float thickness;

      varying vec2 vUv;

			void main() {

        float x = fract(vUv.x * divisions);
        x = min(x, 1.0 - x);

        float xdelta = fwidth(x);
        x = smoothstep(x - xdelta, x + xdelta, thickness);

        float y = fract(vUv.y * divisions);
        y = min(y, 1.0 - y);

        float ydelta = fwidth(y);
        y = smoothstep(y - ydelta, y + ydelta, thickness);

        float c = clamp(x + y, 0.0, 1.0);
        vec3 color = c * gridColor + (1.0 - c) * floorColor;

        gl_FragColor = vec4(color, 1.0);
			}
      `
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.set(-Math.PI / 2, 0, 0);
    scene.add(floor);
    // 影を受ける
    floor.receiveShadow = true;
    scene.add(floor);

    // 天球を作成
    const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0xcdcdcd) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 0 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
      varying vec3 vWorldPosition;

			void main() {

				vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
				vWorldPosition = worldPosition.xyz;

				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			}
      `,
      fragmentShader: `
      uniform vec3 topColor;
			uniform vec3 bottomColor;
			uniform float offset;
			uniform float exponent;

			varying vec3 vWorldPosition;

			void main() {

				float h = normalize( vWorldPosition + offset ).y;
				gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );

			}
      `,
      side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // アニメーション
    function tick() {
      // 箱を回転させる
      box.rotation.x += 0.005;
      box.rotation.y += 0.005;

      const time = performance.now();

      if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // this ensures consistent movements in all directions

        if (moveForward || moveBackward)
          velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        controls.getObject().position.y += velocity.y * delta; // new behavior

        if (controls.getObject().position.y < 10) {
          velocity.y = 0;
          controls.getObject().position.y = 10;

          canJump = true;
        }
      }

      prevTime = time;

      // レンダリング
      renderer.render(scene, camera);

      requestAnimationFrame(tick);
    }

    // 初回実行
    tick();

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          moveForward = true;
          break;

        case "ArrowLeft":
        case "KeyA":
          moveLeft = true;
          break;

        case "ArrowDown":
        case "KeyS":
          moveBackward = true;
          break;

        case "ArrowRight":
        case "KeyD":
          moveRight = true;
          break;

        case "Space":
          if (canJump === true) velocity.y += 350;
          canJump = false;
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown, false);

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          moveForward = false;
          break;

        case "ArrowLeft":
        case "KeyA":
          moveLeft = false;
          break;

        case "ArrowDown":
        case "KeyS":
          moveBackward = false;
          break;

        case "ArrowRight":
        case "KeyD":
          moveRight = false;
          break;
      }
    };
    document.addEventListener("keyup", onKeyUp);

    const onResize = () => {
      // サイズを取得
      const width = window.innerWidth;
      const height = window.innerHeight;

      // レンダラーのサイズを変更
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);

      // カメラのアスペクト比を変更
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    // リサイズイベント発生時に実行
    window.addEventListener("resize", onResize);

    // キャンバスサイズを初期化
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      elm?.removeChild(renderer.domElement);
    };
  });

  return (
    <>
      <div ref={ref} />
      <div ref={menuRef} className="menu">
        <button ref={startButtonRef} className="startButton">
          Start
        </button>
      </div>
    </>
  );
}
