const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/register", // Specify the endpoint to proxy
    createProxyMiddleware({
      target: "http://localhost:3000", // Specify the target server
      changeOrigin: true,
    })
  );

  app.use(
    "/login", // Specify the endpoint to proxy
    createProxyMiddleware({
      target: "http://localhost:3000", // Specify the target server
      changeOrigin: true,
    })
  );
};
