const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "kustomer/products", allowed_formats: ["jpg","jpeg","png","webp"],
    transformation: [{ width:600, height:600, crop:"fill", quality:"auto:good", fetch_format:"auto" }] }
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 },
  fileFilter: (_, f, cb) => {
    ["image/jpeg","image/jpg","image/png","image/webp"].includes(f.mimetype) ? cb(null,true) : cb(new Error("Images only"));
  }
});
module.exports = { upload, cloudinary };
