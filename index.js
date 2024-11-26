const express = require('express');
const db = require('./model/index');
const bodyParser = require('body-parser');
const routes = require('./routes/index');
const app = express();


app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/api", routes);

const port = 3000
app.listen(port, async () => {
  try {
    await db.sequelize.sync({alert:true, force: false });
    console.log('Model has been synced successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
  console.log(`App listening at port http://localhost:${port}`);
})