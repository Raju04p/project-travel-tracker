const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require('pg');

// Load environment variables
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL + "?sslmode=require",
  
})



app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisisted() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
      [currentUserId]
    );
    let countries = [];
    result.rows.forEach((country) => {
      countries.push(country.country_code);
    });
    return countries;
  } finally {
    client.release();
  }
}

async function getCurrentUser() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM users");
    users = result.rows;
    return users.find((user) => user.id == currentUserId);
  } finally {
    client.release();
  }
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    await client.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, currentUserId]
    );
    res.redirect("/");
  } finally {
    client.release();
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const client = await pool.connect();
  try {
    const result = await client.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    const id = result.rows[0].id;
    currentUserId = id;

    res.redirect("/");
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
