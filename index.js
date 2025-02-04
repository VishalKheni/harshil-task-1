const express = require("express");
var morgan = require("morgan");
const db = require("./models/index");
const bodyParser = require("body-parser");
const routes = require("./routes/index");
const app = express();

app.use(express.json());
app.use(express.static("uploads"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan("dev"));

app.use("/api", routes);

const port = 5000;
app.listen(port, async () => {
  try {
    await db.sequelize.sync({ alert: true, force: false });
    console.log(
      "------------>>>>> Model has been synced successfully. ------------>>>>>"
    );
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
  console.log(`App listening at port http://localhost:${port}`);
});

// require("dotenv").config();
// const express = require("express");
// const app = express();
// const morgan = require("morgan");
// const bodyParser = require("body-parser");
// const db = require("./config/db");
// const routes = require("./routes/index");
// const PORT = process.env.PORT;
// const http = require("http");
// const cors = require("cors");
// const { setIO } = require("./helper/io_setup")
// const { socketConfig } = require("./helper/eventHandlers")

// app.use(cors());
// app.use(express.json());
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(express.static("uploads"));
// app.use(morgan("dev"));

// app.get("/", (req, res) => {
//   res.send(`<h1>Chess Capital running</h1>`);
// });

// routes(app);

// let httpServer = http.createServer(app);
// let io = setIO(httpServer);
// socketConfig(io);

// (async () => {
//   try {
//     await db.sequelize.authenticate();
//     console.log("Connection has been established successfully.");
//     // await db.sequelize.sync({ alter: true });
//     console.log(
//       "........................................................................."
//     );
//     await db.sequelize.sync({ alert: true });
//     httpServer.listen(PORT, () => {
//       console.log(`App listening at port http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("Unable to connect to the database:", error);
//   }
// })();
