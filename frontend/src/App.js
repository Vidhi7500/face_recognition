import React, { useState, useRef } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [response, setResponse] = useState(null);
  const [detectionMessage, setDetectionMessage] = useState(null);
  const [loginMessage, setLoginMessage] = useState(null);
  const webcamRef = useRef(null);

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    const blob = dataURItoBlob(imageSrc);
    const capturedFile = new File([blob], "captured-image.jpg", {
      type: "image/jpeg", // Send the image as JPG format
    });
    setFile(capturedFile);
    setPreviewUrl(imageSrc);
  }, [webcamRef]);

  const handleCapturePhoto = () => {
    capture();
  };

  const handleRegister = async () => {
    if (!file) {
      console.error("No image captured!");
      return;
    }

    const formData = new FormData();
    formData.append("photos", file);

    try {
      const res = await axios.post("http://localhost:3000/register", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setResponse(res.data);
      if (res.status === 200) {
        setDetectionMessage("success");
      } else {
        setDetectionMessage("failure");
      }
    } catch (error) {
      console.error("Error:", error);
      setDetectionMessage("failure");
    }
  };

  const handleLogin = async () => {
    if (!file) {
      console.error("No image captured!");
      return;
    }

    const formData = new FormData();
    formData.append("photos", file);

    try {
      const res = await axios.post("http://localhost:3000/login", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setResponse(res.data);
      if (res.status === 200 && res.data.faceMatch) {
        setLoginMessage("success");
      } else {
        setLoginMessage("failure");
      }
    } catch (error) {
      console.error("Error:", error);
      setLoginMessage("failure");
    }
  };

  return (
    <div className="box">
      <h1>Face Detection App</h1>
      <div className="container">
        <div className="webcam-container">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg" // Set screenshot format to JPEG
            videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
            onUserMedia={() => setDetectionMessage(null)}
          />
        </div>
        <button onClick={handleCapturePhoto}>Capture Photo</button>
        {previewUrl && (
          <div>
            <h2>Preview:</h2>
            <img
              src={previewUrl}
              alt="Captured"
              style={{ maxWidth: "100%", maxHeight: 200 }}
            />
          </div>
        )}
        <div
          className="message"
          style={{ color: detectionMessage === "success" ? "green" : "red" }}
        >
          {detectionMessage === "success"
            ? "Registration successful! Please login now."
            : "Registration failed. Please try again."}
        </div>
        <div
          className="message"
          style={{ color: loginMessage === "success" ? "green" : "red" }}
        >
          {loginMessage === "success"
            ? "Login successful! Please login now."
            : "Login failed. Please try again."}
        </div>
        <div className="button-container">
          <button onClick={handleRegister}>Register</button>
          <button onClick={handleLogin}>Login</button>
        </div>
        {response && (
          <div>
            <h2>Response:</h2>
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: "image/jpeg" });
}

export default App;
