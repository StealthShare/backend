import {Blob, File} from 'node:buffer';

import { generateNonce } from "..";

export const  makeFileObjects =(object: any) => {
  // You can create File objects from a Blob of binary data
  // see: https://developer.mozilla.org/en-US/docs/Web/API/Blob
  // Here we're just storing a JSON object, but you can store images,
  // audio, or whatever you want!

}
