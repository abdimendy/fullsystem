/** Business image upload for Netlify (Cloudinary or inline data URL). */

import multipart from 'lambda-multipart-parser';

const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

function cloudinaryEnabled() {
  return !!(process.env.CLOUDINARY_URL?.trim());
}

async function uploadCloudinary(buffer, filename, contentType) {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config(process.env.CLOUDINARY_URL);
  const folder = process.env.CLOUDINARY_FOLDER || 'yellowbook/businesses';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', use_filename: true, unique_filename: true },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export async function handleUpload(event, { json, verifyAuth, getPathname }) {
  const pathname = getPathname(event);
  const method = (event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET' && pathname === '/upload/status') {
    const on = cloudinaryEnabled();
    return json(200, {
      cloudinary: on,
      local: !on,
      message: on
        ? 'Images are stored on Cloudinary.'
        : 'Using inline image URLs (paste URL or upload — stored in database).',
    });
  }

  if (method !== 'POST' || pathname !== '/upload/business-image') {
    return null;
  }

  const user = await verifyAuth(event);
  if (!user) return json(401, { message: 'Unauthorized' });

  let form;
  try {
    form = await multipart.parse(event);
  } catch (err) {
    return json(400, { message: 'Could not parse upload.', detail: String(err?.message || err) });
  }

  const file = form.files?.[0] || form.file;
  if (!file?.content?.length) return json(400, { message: 'No file uploaded.' });

  const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
  if (buffer.length > MAX_BYTES) return json(400, { message: 'Image must be under 5 MB.' });

  const contentType = (file.contentType || 'image/jpeg').toLowerCase();
  if (!ALLOWED.has(contentType)) {
    return json(400, { message: 'Only JPG, PNG, WEBP, or GIF images are allowed.' });
  }

  try {
    if (cloudinaryEnabled()) {
      const result = await uploadCloudinary(buffer, file.filename || 'upload.jpg', contentType);
      const url = result.secure_url || result.url;
      return json(200, {
        url,
        fileName: result.public_id || file.filename,
        provider: 'cloudinary',
        cloudinary: true,
      });
    }

    const base64 = buffer.toString('base64');
    const url = `data:${contentType};base64,${base64}`;
    return json(200, {
      url,
      fileName: file.filename || 'upload',
      provider: 'inline',
      cloudinary: false,
    });
  } catch (err) {
    console.error('[neon-upload]', err);
    return json(500, { message: 'Upload failed.', detail: String(err?.message || err) });
  }
}
