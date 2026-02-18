require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();

// ================= CONFIG =================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo123",
    resave: false,
    saveUninitialized: false,
  })
);

// ================= MONGODB =================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.log(err));

// ================= MODELS =================

const userSchema = new mongoose.Schema({
  nome: String,
  cpf: String,
  whatsapp: String,
  email: String,
  username: { type: String, unique: true },
  password: String,
  isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

// ================= CRIAR ADMIN FIXO =================

async function createAdmin() {
  const adminExists = await User.findOne({ username: "adminunlock2003" });

  if (!adminExists) {
    const hashed = await bcrypt.hash("unlockh81820", 10);

    await User.create({
      nome: "Administrador",
      username: "adminunlock2003",
      password: hashed,
      isAdmin: true
    });

    console.log("Admin criado");
  }
}

createAdmin();

// ================= CADASTRO =================

app.post("/register", async (req, res) => {
  try {
    const { nome, cpf, whatsapp, email, username, password, confirmPassword } = req.body;

    if (!nome || !username || !password) {
      return res.send("Preencha todos os campos obrigatórios.");
    }

    if (password !== confirmPassword) {
      return res.send("As senhas não coincidem.");
    }

    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.send("Usuário já existe.");
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      nome,
      cpf,
      whatsapp,
      email,
      username,
      password: hashed
    });

    res.redirect("/login.html");

  } catch (err) {
    console.log(err);
    res.send("Erro no cadastro.");
  }
});

// ================= LOGIN =================

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.send("Usuário não encontrado.");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Senha incorreta.");

    req.session.userId = user._id;
    req.session.isAdmin = user.isAdmin;

    if (user.isAdmin) {
      return res.redirect("/admin.html");
    }

    res.redirect("/dashboard.html");

  } catch (err) {
    console.log(err);
    res.send("Erro ao fazer login.");
  }
});

// ================= LOGOUT =================

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
