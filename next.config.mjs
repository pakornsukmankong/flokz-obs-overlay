/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // overlay/capture logic ไม่ควรถูก mount ซ้ำใน dev
  devIndicators: false, // ซ่อนป้าย dev ของ Next (ไม่ให้โผล่บน overlay ใน OBS)
};

export default nextConfig;
