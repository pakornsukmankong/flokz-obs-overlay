import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * jsonEtag — ตอบ JSON พร้อม ETag; ถ้า client ส่ง If-None-Match มาตรงกัน ตอบ 304 (ไม่มี body)
 *
 * overlay หลายตัว (talk/donate-alert/top-donors/grind-overlay) poll endpoint เดิมซ้ำทุก 1.5-3
 * วินาที "ตลอดที่เปิด OBS" (เป็นชั่วโมง) — ถ้าไม่มี ETag ทุก poll จะโหลด body เต็มซ้ำๆ
 * (โดยเฉพาะ /api/talk ที่มีรูป avatar เป็น base64 ฝังอยู่ในนั้น) กิน bandwidth มหาศาลแบบไม่จำเป็น
 * เพราะข้อมูลแทบไม่เปลี่ยนระหว่าง poll แต่ละครั้งเลย
 *
 * ฝั่ง client ต้อง fetch ด้วย cache: "no-cache" (ไม่ใช่ "no-store") เบราว์เซอร์ถึงจะแนบ
 * If-None-Match ให้เองและใช้ body ที่ cache ไว้ตอนได้ 304 กลับมา (ไม่ต้องเขียน logic เพิ่มฝั่ง client)
 */
export function jsonEtag(req: Request, data: unknown): NextResponse {
  const body = JSON.stringify(data);
  const etag = '"' + crypto.createHash("sha1").update(body).digest("hex") + '"';
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
}
