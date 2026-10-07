import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Ensure uploads directory exists
if (!fs.existsSync('uploads/')) {
    fs.mkdirSync('uploads/', { recursive: true })
}

const upload = multer({
    dest: 'uploads/',
    limits: { 
        fileSize: 5 * 1024 * 1024, // Facebook WhatsApp limit: 5MB for images
        files: 1 // Only allow single file upload
    },
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (_req, file, cb) => {
            // Generate unique filename with timestamp
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            const ext = path.extname(file.originalname)
            cb(null, `header-image-${uniqueSuffix}${ext}`)
        }
    }),
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        const mimeType = file.mimetype

        // Facebook WhatsApp Business API supported image formats
        const allowedExtensions = ['.jpg', '.jpeg', '.png']
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png']

        if (!allowedExtensions.includes(ext)) {
            cb(new Error(`Unsupported file extension! Only ${allowedExtensions.join(', ')} are allowed for WhatsApp images`), false)
            return
        }

        if (!allowedMimeTypes.includes(mimeType)) {
            cb(new Error(`Unsupported MIME type! Only ${allowedMimeTypes.join(', ')} are allowed for WhatsApp images`), false)
            return
        }

        cb(null, true)
    }
})



export default upload