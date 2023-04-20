const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeDBServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at: http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Token", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 1 Login User
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user
                             WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "My_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertSnakeToCamel = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};

//API 2 Get All States
app.get("/states/", authenticateToken, async (request, response) => {
  const selectStatesQuery = `SELECT * FROM state;`;
  const statesList = await db.all(selectStatesQuery);
  response.send(statesList.map((eachState) => convertSnakeToCamel(eachState)));
});

//API 3 Get State
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateObject = await db.get(selectStateQuery);
  response.send(convertSnakeToCamel(stateObject));
});

//API 4 POST District
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `INSERT INTO district
                            (district_name, state_id, cases, cured, active, deaths)
                            VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const postDistrictObject = await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

const convertSnakeToCamelDistrict = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

//API 5 Get District
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district
                              WHERE district_id = ${districtId};`;
    const getDistrictObject = await db.get(getDistrictQuery);
    response.send(convertSnakeToCamelDistrict(getDistrictObject));
  }
);

//API 6 Delete District
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district
                              WHERE district_id = ${districtId};`;
    const deleteDistrictObject = await db.get(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7 Update District
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `UPDATE district
                               SET district_name = '${districtName}',
                                   state_id = ${stateId},
                                   cases = ${cases},
                                   cured = ${cured},
                                   active = ${active},
                                   deaths = ${deaths}
                              WHERE district_id = ${districtId};`;
    const updateDistrictObject = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8 Get All Total Values
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalStats = `SELECT SUM(cases),
                                  SUM(cured),
                                  SUM(active),
                                  SUM(deaths)
                            FROM district
                            WHERE state_id  = ${stateId};`;
    const stats = await db.get(getTotalStats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
