let tf = require("@tensorflow/tfjs-node");
let faceapi = require("@vladmandic/face-api");
const path = require("path");
let canvas = require("canvas");
let uuid = require("uuid");
let node_json_db = require("node-json-db");
const { JsonDB } = node_json_db;
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");
const { Canvas, Image, ImageData } = canvas;
const fs = require("fs");
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const bodyParser = require("body-parser");
var jsonParser = bodyParser.json();

var urlencodedParser = bodyParser.urlencoded({ extended: false });

router.post("/login", urlencodedParser, async (req, res) => {
  const model = (function () {
    let elements = {
      matchData: [],
      findedBool: false,
      isMatched: false,
      path1: "",
      path2: "",
      BASE_ROOT_LOGIN: `${__dirname}${path.sep}login-images${path.sep}`,
      database: "",
    };
    async function StartLibrary(data, databaseData) {
      let getdata = await validateIMG();
      if (getdata.status == 1) {
        data = assignValue(getdata);
        let database = createDatabase();
        Store(database);
        const MODEL_URL = `.${path.sep}models`;
        Promise.all([
          await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_URL),
          await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL),
          await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL),
        ])
          .then((val) => {
            const forLoop = async (_) => {
              for (let i = 0; i < data.length; i++) {
                if (elements.findedBool == false) {
                  let src = data[i].ImageLink;
                  model.elements.path1 = `${model.elements.BASE_ROOT_LOGIN}${getdata.data.name}`;
                  try {
                    let image = await canvas.loadImage(src);
                    const myCanvas = canvas.createCanvas(200, 200);
                    const ctx = myCanvas.getContext("2d");
                    ctx.drawImage(image, 0, 0, 200, 200);
                    const detections = await faceapi
                      .detectAllFaces(
                        myCanvas,
                        new faceapi.SsdMobilenetv1Options()
                      )
                      .withFaceLandmarks()
                      .withFaceDescriptors();
                    if (detections.length != 0 && detections.length < 2) {
                      fs.unlinkSync(model.elements.path1);
                      Analyser(detections, databaseData);
                      elements.findedBool = true;
                    } else if (detections.length == 0) {
                      if (i + 1 != data.length) {
                        res.status(400).send({
                          status: 0,
                          err: `${detections.length} Face Detected`,
                        });
                        fs.unlinkSync(model.elements.path1);
                      } else {
                        fs.unlinkSync(model.elements.path1);
                        res.status(400).send({
                          status: 0,
                          err: `${detections.length} Face Detected`,
                        });
                      }
                    } else if (detections.length >= 2) {
                      if (i + 1 != data.length) {
                        fs.unlinkSync(model.elements.path1);
                        res.status(400).send({
                          status: 0,
                          err: `${detectionss.length} faces`,
                        });
                      } else {
                        fs.unlinkSync(model.elements.path1);
                        res.status(400).send({
                          status: 0,
                          err: `${detections.length} Face Detected`,
                        });
                      }
                    }
                  } catch (err) {
                    res
                      .status(400)
                      .send({ status: 0, isTrusted: true, message: err });
                  }
                }
              }
            };
            forLoop();
          })
          .catch((err) => res.send(err));
      } else {
        res.status(400).send(getdata);
      }
    }
    function assignValue(data) {
      return [
        {
          ImageLink: `${elements.BASE_ROOT_LOGIN}${data.data.name}`,
        },
      ];
    }
    async function validateIMG() {
      try {
        if (!req.files) {
          return {
            status: 0,
            err: "no image Uploaded",
          };
        } else {
          let fileImg = req.files.photos;
          if (
            path.extname(fileImg.name).toLocaleLowerCase() === ".png" ||
            path.extname(fileImg.name).toLocaleLowerCase() === ".jpg" ||
            path.extname(fileImg.name).toLocaleLowerCase() === ".jpeg"
          ) {
            fileImg.mv(
              `${__dirname}${path.sep}login-images${path.sep}` + fileImg.name
            );
            model.elements.path1 =
              `${__dirname}${path.sep}login-images${path.sep}` + fileImg.name;
            let response = {
              status: 1,
              message: "File is Uploaded",
              data: {
                name: fileImg.name,
                mimetype: fileImg.mimetype,
                size: fileImg.size,
              },
            };
            return response;
          } else {
            return {
              status: 0,
              err: `Unsopported File type`,
            };
          }
        }
      } catch (err) {
        res.status(500).send(err);
      }
    }
    async function Analyser(detections, databaseData) {
      if (Object.keys(databaseData).length === 0) {
        res.status(200).send({ err: "No active Users !", status: 1 });
        elements.isMatched = true;
      }
      let j = 0;
      while (elements.isMatched == false) {
        for (let i = 0; i < Object.values(databaseData).length; i++) {
          if (Number(Object.values(databaseData)[i].age) > 3) {
            let DescriptorFirst = Object.values(databaseData)[i].Descriptor;
            let DescriptorFirstCorrect = await CorrectSpelling(DescriptorFirst);
            let DescriptorSecond = detections[0].descriptor;
            let token = Object.values(databaseData)[i].Token;
            let response = await faceMatch(
              DescriptorFirstCorrect,
              DescriptorSecond,
              token
            );
            console.log(response);
            if (response.status == 1) {
              elements.isMatched = response;
              j == 0 ? finishAPI(elements.isMatched) : (j = 1);
              j = 1;
            } else if (Object.keys(databaseData).length == i + 1 && j == 0) {
              elements.isMatched = response;
              finishAPI(elements.isMatched);
            }
          }
        }
      }
    }
    async function CorrectSpelling(DescriptorFirst) {
      return Object.values(DescriptorFirst[0]);
    }
    async function faceMatch(resultsReference, resultsQuery, token) {
      const threshold = 0.5;
      let descriptors = { desc1: resultsReference, desc2: resultsQuery };
      const distance = faceapi.utils.round(
        faceapi.euclideanDistance(descriptors.desc1, descriptors.desc2)
      );
      if (distance < threshold) {
        elements.matchData.push({
          faceMatch: true,
          token: token,
          status: 1,
          isTrusted: true,
          distance: distance,
        });
        return {
          faceMatch: true,
          token: token,
          status: 1,
          isTrusted: true,
          distance: distance,
        };
      } else {
        elements.matchData.push({
          faceMatch: false,
          status: 0,
          isTrusted: true,
          distance: distance,
        });
        return {
          faceMatch: false,
          status: 0,
          isTrusted: true,
          distance: distance,
        };
      }
    }
    function createDatabase() {
      let db = new JsonDB(new Config("DataBase", true, false, "/"));
      return db;
    }
    function Store(parameter) {
      model.elements.database = parameter;
    }
    async function finishAPI(data) {
      if (data.status == 1) {
        res.status(200).send(data);
      } else {
        res.status(400).send(data);
      }
    }
    return {
      elements,
      StartLibrary,
      Analyser,
      faceMatch,
      finishAPI,
      createDatabase,
      Store,
      CorrectSpelling,
      assignValue,
      validateIMG,
    };
  })();
  const controller = (function () {
    function init() {
      if (!fs.existsSync(`${__dirname}${path.sep}login-images`)) {
        fs.mkdirSync(`${__dirname}${path.sep}login-images`);
      }
      // Getting the Request
      let dataFromUserNowWebcam = [{}];
      if (fs.existsSync(`${__dirname}${path.sep}Database.json`)) {
        model.elements.database = model.createDatabase();
        let databaseData = model.elements.database.getData("/");
        model.StartLibrary(dataFromUserNowWebcam, databaseData);
      } else {
        res.status(200).send({
          err: "No Active Users Find . Please Register First .",
          status: 0,
          isTrusted: true,
        });
      }
    }
    return {
      init,
    };
  })();
  controller.init();
});

module.exports = router;
