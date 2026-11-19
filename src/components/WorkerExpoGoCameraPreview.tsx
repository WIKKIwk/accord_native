import type { CameraView } from 'expo-camera';
import type { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

const vertexSource = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    // Android Expo GL's camera copy inverts both axes. Crop the portrait
    // 3:4 feed vertically to fill the square at its fixed scale.
    uv = vec2(0.5 - position.x * 0.5, 0.5 - position.y * 0.375);
  }
`;
const fragmentSource = `
  precision mediump float;
  uniform sampler2D cameraFrame;
  varying vec2 uv;
  void main() {
    gl_FragColor = texture2D(cameraFrame, uv);
  }
`;

function compileShader(gl: ExpoWebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('Could not allocate the camera shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  throw new Error('Could not compile the camera shader');
}

function startPreview(gl: ExpoWebGLRenderingContext, texture: WebGLTexture, onFailure: () => void) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  const vertices = gl.createBuffer();
  if (!program || !vertices) throw new Error('Could not allocate the camera preview');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not link the camera preview');
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(program, 'cameraFrame'), 0);

  let frame = 0;
  let lastDraw = -Infinity;
  const render = (timestamp: number) => {
    try {
      if (timestamp - lastDraw >= 32) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.endFrameEXP();
        lastDraw = timestamp;
      }
      frame = requestAnimationFrame(render);
    } catch {
      onFailure();
    }
  };
  frame = requestAnimationFrame(render);
  // Unmounting the GLView frees the program and buffer with its context.
  return () => cancelAnimationFrame(frame);
}

export function WorkerExpoGoCameraPreview({ camera, onFailure }: {
  camera: CameraView | null;
  onFailure(): void;
}) {
  const view = useRef<GLView>(null);
  const [Renderer] = useState<typeof GLView | null>(() => {
    try {
      // Load only on the Expo GL path, in the same Metro bundle as the scanner.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return (require('expo-gl') as typeof import('expo-gl')).GLView;
    } catch {
      return null;
    }
  });
  const [context, setContext] = useState<ExpoWebGLRenderingContext | null>(null);
  useEffect(() => {
    if (!Renderer) onFailure();
  }, [Renderer, onFailure]);

  useEffect(() => {
    const glView = view.current;
    if (!camera) return;
    let mounted = true;
    let stop: (() => void) | undefined;
    let texture: WebGLTexture | undefined;
    const timeout = setTimeout(onFailure, 5_000);
    const releaseTexture = (object: WebGLTexture) => {
      // The native camera may already have been detached as the sheet closes.
      void glView?.destroyObjectAsync(object as WebGLTexture & { id: number }).catch(() => {});
    };
    if (glView && context) {
      void glView.createCameraTextureAsync(camera).then(object => {
        if (!mounted) {
          releaseTexture(object);
          return;
        }
        texture = object;
        stop = startPreview(context, object, onFailure);
        clearTimeout(timeout);
      }).catch(() => { if (mounted) onFailure(); });
    }
    return () => {
      mounted = false;
      clearTimeout(timeout);
      stop?.();
      if (texture) releaseTexture(texture);
    };
  }, [camera, context, onFailure]);

  return Renderer ? <Renderer ref={view} style={StyleSheet.absoluteFill} onContextCreate={setContext} /> : null;
}
