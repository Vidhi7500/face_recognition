// routes/registerRoutes.js
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
const { register } = require("../controllers/registerController");

router.post("/register", (req, res) => {
  const model = (function () {
    let elements = {
      count: 0,
      result: [],
      faceMatch: [],
      path: "",
      BASE_ROOT_REGISTER: `${__dirname}${path.sep}register-images${path.sep}`,
      database: "",
    };
    async function StartLibrary(data) {
      const MODEL_URL = path.join(__dirname, `${path.sep}models${path.sep}`);
      Promise.all([
        // check modules spelling
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_URL),
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL),
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL),
        await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_URL),
        await faceapi.nets.ageGenderNet.loadFromDisk(MODEL_URL),
      ])
        .then((val) => {
          const forLoop = async (_) => {
            for (let i = 0; i < data.length; i++) {
              let src = data[i].ImageLink;
              model.elements.path = src;
              let image = await canvas.loadImage(src);
              const myCanvas = canvas.createCanvas(200, 200);
              const ctx = myCanvas.getContext("2d");
              ctx.drawImage(image, 0, 0, 200, 200);
              const detections = await faceapi
                .detectAllFaces(myCanvas, new faceapi.SsdMobilenetv1Options())
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender()
                .withFaceDescriptors();
              const detection = detections;
              if (detection.length === 1) {
                let database = createDatabase();
                Store(database);
                let descriptions = [detection[0].descriptor];
                StartFaceMatch(detection, data, "", descriptions);
              } else if (detection.length > 1) {
                let msg = `${detection.length} Face Detected`;
                const err = {
                  msg,
                  isTrusted: true,
                  status: 0,
                };
                fs.unlinkSync(model.elements.path);
                res.status(400).send(err);
              } else if (detection.length == 0) {
                let msg = `No Face`;
                const err = {
                  msg,
                  isTrusted: true,
                  status: 0,
                };
                fs.unlinkSync(model.elements.path);
                res.status(400).send(err);
              }
            }
          };
          forLoop();
        })
        .catch((err) => console.log(err));
    }
    async function validateIMG() {
      try {
        if (!req.files) {
          return {
            status: 0,
            err: "no image Uploaded yet",
          };
        } else {
          let fileImg = req.files.photos;
          if (
            path.extname(fileImg.name).toLocaleLowerCase() === ".png" ||
            path.extname(fileImg.name).toLocaleLowerCase() === ".jpg" ||
            path.extname(fileImg.name).toLocaleLowerCase() === ".jpeg"
          ) {
            fileImg.mv(
              `${__dirname}${path.sep}register-images${path.sep}` + fileImg.name
            );
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
    async function StartFaceMatch(detection, dataPrev, userName, descriptions) {
      userName = "";
      if (
        userName !== null &&
        userName !== undefined &&
        descriptions !== null &&
        descriptions !== undefined &&
        descriptions !== "" &&
        detection.length == 1
      ) {
        const singlelabeledDescriptor = new faceapi.LabeledFaceDescriptors(
          userName,
          descriptions
        );
        const faceMatcher = new faceapi.FaceMatcher(singlelabeledDescriptor);
        const facePersonalities = await crud(faceMatcher, detection);
        elements.faceMatch.push(facePersonalities);
      } else {
        elements.faceMatch.push(detection);
      }
      model.elements.count++;
      if (model.elements.faceMatch.length == dataPrev.length) {
        fs.unlinkSync(model.elements.path);
        try {
          if (model.elements.faceMatch[0].status === 1) {
            model.elements.database.push(
              `/${model.elements.faceMatch[0].token}`,
              {
                age: model.elements.faceMatch[0].age,
                expression: model.elements.faceMatch[0].expressions,
                gender: model.elements.faceMatch[0].gender,
                Descriptor:
                  model.elements.faceMatch[0].Descriptor._labeledDescriptors[0]
                    .descriptors,
                Token: model.elements.faceMatch[0].token,
              }
            );
            res
              .status(200)
              .send({
                age: model.elements.faceMatch[0].age,
                expression: model.elements.faceMatch[0].expressions,
                gender: model.elements.faceMatch[0].gender,
                token: model.elements.faceMatch[0].token,
              });
          } else {
            res.status(500).send({ status: 0, err: "err occoured" });
          }
        } catch (err) {
          res.status(500).send({ status: 0, errContext: "Error Occured" });
        }
      }
    }
    function Store(data) {
      model.elements.database = data;
    }
    function createToken() {
      return uuid.v1();
    }
    function createDatabase() {
      let db = new JsonDB(new Config("DataBase", true, false, "/"));
      return db;
    }
    async function crud(Descriptor, detection) {
      if (detection.length != 0 && detection.length < 2) {
        const index = 0;
        const age = gettingAge(detection, index);
        const expressions = gettingExpressions(detection, index);
        const genderProbability = gettingGenderProbablity(detection, index);
        const gender = getGender(detection, index, genderProbability);
        const token = createToken();
        const result = readyInject(
          Descriptor,
          age,
          expressions,
          gender,
          token,
          1
        );
        return result;
      } else {
        return {
          type: "err",
          status: 0,
          errText: `${detection.length} Faces Detected .`,
        };
      }
    }
    function gettingAge(detection, index) {
      const age = Math.round(detection[index].age);
      return age;
    }
    function gettingExpressions(detection, index) {
      const expressions = detection[index].expressions;
      const values = Object.values(expressions);
      const maxValue = Math.max(...values);
      const FindedIndex = values.indexOf(maxValue);
      const Maxkey = Object.keys(expressions)[FindedIndex];
      return Maxkey;
    }
    function getGender(detection, index, genderProbability) {
      const gender = detection[index].gender;
      if (
        gender != undefined &&
        gender != "" &&
        Math.round(genderProbability) >= 0.2
      ) {
        return gender;
      } else {
        return "";
      }
    }
    function assignValue(data) {
      return [
        {
          ImageLink: `${elements.BASE_ROOT_REGISTER}${data.data.name}`,
          userName: data.data.userName,
        },
      ];
    }
    function gettingGenderProbablity(detection, index) {
      const genderProbablity = detection[index].genderProbability;
      return genderProbablity;
    }
    function readyInject(Descriptor, age, expressions, gender, token, status) {
      return {
        Descriptor,
        age,
        expressions,
        token,
        gender,
        status,
      };
    }
    return {
      elements,
      StartLibrary,
      StartFaceMatch,
      gettingExpressions,
      createToken,
      crud,
      gettingAge,
      getGender,
      gettingGenderProbablity,
      readyInject,
      createDatabase,
      validateIMG,
      assignValue,
    };
  })();
  const controller = (function () {
    async function init() {
      if (!fs.existsSync(`${__dirname}${path.sep}register-images`)) {
        fs.mkdirSync(`${__dirname}${path.sep}register-images`);
      }
      let data = await model.validateIMG();
      if (data.status == 0) {
        res.status(400).send(data);
      } else {
        let reUpdateData = model.assignValue(data);
        model.StartLibrary(reUpdateData);
      }
    }
    return {
      init,
    };
  })();
  controller.init();
});

module.exports = router;
