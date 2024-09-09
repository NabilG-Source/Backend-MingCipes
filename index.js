import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const app = express();
const SecretKey =
  "idffauygdogisddi26t23878oi46879823ud312775168532e8717618719821%R&&!#E%RV@NDYU";
mongoose.connect("mongodb://localhost:27017/resep", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const allowedOrigins = ["http://localhost:3000", "http://192.168.100.92:3000", "https://frontend-ming-cipes.vercel.app/"];

app.use(
  cors({
    origin: function (origin, callback) {
    if(allowedOrigins.includes(origin) || !origin){
    callback(null, true);
    } else {
    callback(new Error("Not allowed by CORS"));
    }
  },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const db = mongoose.connection;
db.on("error", (error) => console.log(error));
db.on("open", () => console.log("Successfuly connected into mongodb"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "../frontend/public/image/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

const resepSchemas = mongoose.Schema({
  namaResep: { type: String, required: true },
  bahan: { type: [String], required: true },
  cara: { type: [String], required: true },
  image: { type: String, required: true },
  upload: { type: String, required: true },
  uploadUsername: { type: String, required: true },
  categories: { type: [String], required: true },
  dateAdded: { type: String, required: true },
});

const userSchemas = mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  userAllRecipeAdded: { type: Array, required: true },
  role: { type: String, required: true },
});

const resepSchema = mongoose.model("Resep", resepSchemas);
const userSchema = mongoose.model("Users", userSchemas);

const authenticateToken = (req, res, next) => {
  // const authHeader = req.headers["authorization"];
  // const tokenAuth = authHeader && authHeader.split(" ")[1];
  const tokenCookies = req.cookies.refreshToken;

  if (!tokenCookies)
    return res.status(403).json({ message: "Status Forbidden" });
  jwt.verify(tokenCookies, SecretKey, (err, user) => {
    if (err) return res.status(404).json({ message: err.message });

    const convertIAT = new Date(user.iat * 1000);
    const convertEXP = new Date(user.exp * 1000);

    const infoUser = {
      issuedAt: user.iat,
      expirationTime: user.exp,
      convertedIAT: convertIAT.toLocaleString("id-ID"),
      convertedEXP: convertEXP.toLocaleString("id-ID"),
    };
    req.user = infoUser;
    next();
  });
};

app.post("/logout", (req, res) => {
  res.clearCookie("refreshToken");
  res.clearCookie("userData");
  res.status(200).json({ message: "Logout successful" });
});

app.post("/resep", upload.single("imageData"), async (req, res) => {
  try {
    const dataResep = {
      ...req.body,
      bahan: JSON.parse(req.body.bahan),
      cara: JSON.parse(req.body.cara),
      image: req.file.filename,
      categories: JSON.parse(req.body.categories),
    };
    const newResep = new resepSchema(dataResep);
    await newResep.save();
    res.status(201).json(newResep);
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: error.message });
  }
});

app.patch("/resep/update/nonuser/:id", upload.single('imageData'), async (req, res) => {
  try {
    const updateTheRecipe = await resepSchema.updateOne(
      { _id: req.params.id },
      { $set: {
       "namaResep": req.body.namaResep,
       "bahan": JSON.parse(req.body.bahan),
       "cara": JSON.parse(req.body.cara),
       "categories": JSON.parse(req.body.category),
       "image": req.file.filename,
      }}
    )

    res.status(200).json(updateTheRecipe);
  } catch (error) {
    console.log(error)
    res.status(400).json({message: error.message})
  }
})

app.patch("/resep/update/:id/:usid", upload.single('imageData'), async (req, res) => {
  try{

    const updateRecipe = await userSchema.updateOne(
      { _id: req.params.usid, "userAllRecipeAdded._id": req.params.id }, 
      {
        $set: {
          "userAllRecipeAdded.$.namaResep": req.body.namaResep, 
          "userAllRecipeAdded.$.bahan":JSON.parse(req.body.bahan),         
          "userAllRecipeAdded.$.cara": JSON.parse(req.body.cara),          
          "userAllRecipeAdded.$.categories": JSON.parse(req.body.category), 
          "userAllRecipeAdded.$.image": req.file.filename           
        }
      }
    );
    res.status(200).json(updateRecipe);
} catch (error){
    res.status(400).json({message: error.message});
}
});


app.post("/resep/add/:id", upload.single("imageData"), async (req, res) => {
  try {
    const dataResep = {
      ...req.body,
      bahan: JSON.parse(req.body.bahan),
      cara: JSON.parse(req.body.cara),
      image: req.file.filename,
      categories: JSON.parse(req.body.categories),
    };

    try {
      const resepAdded = await userSchema.findOne({ _id: req.params.id });
    if (!resepAdded) {
      return res.status(404).json({ message: "User not found" });
    }

    resepAdded.userAllRecipeAdded.push(dataResep);
    await resepAdded.save();

    res.status(200).json(resepAdded);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/refresh-token", (req, res) => {
  const tokenCookies = req.cookies.refreshToken;
  if (!tokenCookies) return res.status(401).json({ message: error.message });

  jwt.verify(tokenCookies, SecretKey, (err, user) => {
    if (err) return res.sendStatus(403);

    const newAccessToken = jwt.sign({ username: user.username }, SecretKey, {
      expiresIn: "1d",
    });
    res.cookie("refreshToken", tokenCookies, {
      maxAge: 900000,
      httpOnly: false,
    });
    res.json({ refreshToken: newAccessToken });
  });
});

app.post("/signup", async (req, res) => {
  const { username, password, role } = req.body;
  const user = await userSchema.findOne({ username });
  if (user)
    return res.status(400).json({ message: "Username is already taken" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new userSchema({ username, password: hashedPassword, role });
  await newUser.save();
  res.status(201).json({ message: "User registered successfully" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await userSchema.findOne({ username });

  if (!user) return;
  const compared = bcrypt.compare(user.password, password);
  if (!compared) return;

  const accessToken = jwt.sign({ username: user.username }, SecretKey, {
    expiresIn: "1d",
  });
  const refreshToken = jwt.sign({ username: user.username }, SecretKey, {
    expiresIn: "1d",
  });

  res.cookie("refreshToken", refreshToken, { maxAge: 900000, httpOnly: false });
  res.cookie("userData", user, { maxAge: 900000, httpOnly: false });
  res.json({ accessToken, refreshToken, user });
});

app.get("/", async (req, res) => {
  const cookie = req.cookies;
  res.json({ cookie });
});

app.get("/user", async (req, res) => {
  try {
    const user = await userSchema.find();
    res.json(user);
  } catch (error) {
    es.status(500).json({ message: error.message });
  }
});

app.get("/dashboard", authenticateToken, async (req, res) => {
  const userData = req.cookies.userData;
  const userIds = req.cookies.userData._id;
  const user = await userSchema.findOne({ _id: userIds });

  res.json({ userData: user });
});

app.get("/resep", async (req, res) => {
  try {
    const resep = await resepSchema.find();
    res.json(resep);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/user/find/:id", async (req, res) => {
  try {
    const userFound = await userSchema.findById(req.params.id);
    res.status(200).json(userFound);
  } catch (error) {
    res.status(404).json({message: error.message})
  }
})

app.get("/resep/find/:id", async (req, res) => {
  
  try {
    const resep = await resepSchema.findById(req.params.id);
    res.json(resep);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

app.delete("/user/resep/delete/:id/:usid", async (req, res) => {
  try {
    const resepDeleted = await userSchema.updateOne(
      { _id: req.params.usid }, 
      { $pull: { userAllRecipeAdded: { _id: req.params.id }}} 
    );
    return res.status(200).json(resepDeleted);
  } catch (error) {
    res.status(400).json({message: error.message})
  }
})

app.delete("/resep/delete/:id", async (req, res) => {
  try {
    const resepDeleted = await resepSchema.deleteOne({ _id: req.params.id });
    res.status(200).json(resepDeleted);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.listen(5000, () => {
  console.log("Server is listening on port 5000");
});
