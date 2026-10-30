import { bake } from "./bake.js";

onmessage = ({ data: names }) => {
  for (const name of names) {
    try {
      const images = bake(name);
      postMessage({ name, images }, Object.values(images).map((image) => image.data.buffer));
    } catch {
      postMessage({ name, images: null });
    }
  }
};
