"use strict";
// Adapted from https://github.com/zesty-io/node-sdk/blob/master/examples/upload/index.js

require("dotenv").config();

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const util = require("util");
const SDK = require("@zesty-io/sdk");

// !!! Do not commit your password to a repository. This needs to stay secret.
// We only have you enter it here for simplicity of the example.
const ZESTY_ACCESS_TOKEN = process.env.ZESTY_ACCESS_TOKEN; // Change this to your access token
const ZESTY_INSTANCE_ZUID = process.env.ZESTY_INSTANCE_ZUID; // Change this to your instance ZUID
const ZESTY_BIN_ZUID = process.env.ZESTY_BIN_ZUID; // Change this to your media bin ZUID
const ZESTY_MODEL_ZUID = process.env.ZESTY_MODEL_ZUID; // Change this to your model ZUID
const ZESTY_USER_ZUID = process.env.ZESTY_USER_ZUID; // Change this to your user ZUID

async function main() {
  console.log("CAMERA ON");

  const auth = new SDK.Auth();
  const session = await auth.login(
    process.env.ZESTY_USER_EMAIL,
    process.env.ZESTY_USER_PASSWORD
  );

  if (!session.token) {
    throw new Error(JSON.stringify(session));
  }

  const zesty = new SDK(process.env.ZESTY_INSTANCE_ZUID, session.token);

  setInterval(() => {
    // Unix timestamp. Time since in milliseconds since 1970.
    const epoch = Date.now();
    const fileName = `garden_img_${epoch}.jpg`;
    const title = `PI Zero Garden Photo Taken on ${epoch}`;

    // This sends the image stream to stdout
    exec(
      `raspistill --encoding jpg --output ./${fileName}`,
      (err, stdout, stderr) => {
        if (err || stderr) {
          // Something went wrong taking a photo
          console.error(stderr);
          // The camera crashed
          console.error(err);
        } else {
          // Read file that raspistill created
          const stream = fs.createReadStream(
            path.resolve(__dirname, `./${fileName}`)
          );

          // Send file to Zesty
          zesty.media
            .createFile(ZESTY_BIN_ZUID, stream, { title, fileName })
            .then((file) => {
              // Create headless data model record
              return zesty.instance.createItem(ZESTY_MODEL_ZUID, {
                data: {
                  title: file.data[0].title,
                  image: file.data[0].id,
                },
                meta: {
                  contentModelZUID: ZESTY_MODEL_ZUID,
                  createdByUserZUID: ZESTY_USER_ZUID,
                },
              });
            })
            .then((rec) => {
              // Publish record so it is live
              return zesty.instance.publishItem(
                ZESTY_MODEL_ZUID,
                rec.data.ZUID,
                1 // We avoid make a request to look the version because we know it's one as we just created the record
              );
            })
            .then((file) => {
              // For debugging
              // Running this while in our garden would consume alot of memory overtime
              // Which could crash the PI Zero
              // console.log(util.inspect(file, false, null));

              // FIXME: Can not publish with access tokens!!!

              // Maintain promise chain
              return file;
            })
            .catch((err) => {
              console.error(err);
              console.error("Failed saving photo to Zesty.io");
              console.log("CAMERA OFF");
            })
            .finally(() => {
              // Remove file.
              // The PI does not have a lot of space and
              // this is going to make a lot of images
              fs.unlinkSync(path.resolve(__dirname, `./${fileName}`));
            });
        }
      }
    );
  }, 60000); // Take a photo every minute
}

// Start the function
main();
