// Subtle PS2-era post-processing: a light bloom over the warm village. Falls
// back to a plain render if the addons cannot be loaded.
import * as THREE from 'three';

export async function createPostFX({ renderer, scene, camera }) {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
    ]);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,
      0.7,
      0.85,
    );
    composer.addPass(bloom);
    return {
      enabled: true,
      composer,
      bloom,
      render: () => composer.render(),
      setSize: (width, height) => composer.setSize(width, height),
    };
  } catch {
    return {
      enabled: false,
      render: () => renderer.render(scene, camera),
      setSize: () => {},
    };
  }
}
