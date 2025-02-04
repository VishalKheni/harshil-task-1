const fs = require("fs").promises;
const validateFiles = async (files, acceptedExtensions, maxFileSize) => {
  if (!Array.isArray(files)) {
    return { valid: false, message: 'Files should be an array' };
  }
    const invalidFileType = files.some(
      (file) => !acceptedExtensions.includes(file.originalname.split(".").pop().toLowerCase())
    );
    const invalidFileSize = files.some((file) => file.size > maxFileSize);
  
    if (invalidFileType) {
      for (const file of files) {
        try{
        await fs.unlink(file.path);
        }catch(e){console.log(e)}
      }
      return { valid: false, message: `Invalid file type. Only ${acceptedExtensions.join(', ')} are allowed` };
    }
  
    if (invalidFileSize) {
      for (const file of files) {
        try{
        await fs.unlink(file.path);
      }catch(e){console.log(e)}
      }
      return { valid: false, message: `Image size must be less than${maxFileSize / (1024 * 1024)}MB` };
    }
  
    return { valid: true }
  };

  module.exports = validateFiles;