/** @type {import('next').NextConfig} */
const nextConfig = {
  // El análisis de frames envía imágenes en base64 en el cuerpo de la petición.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
