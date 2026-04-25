import { action } from "./_generated/server";
import { v } from "convex/values";

// Convex actions execute in a Node.js environment where process.env is available
declare const process: { env: Record<string, string | undefined> };

// Calls Groq's vision API server-side so the API key is never exposed to the browser
export const parseScheduleImage = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(), // e.g. "image/jpeg"
  },
  handler: async (_ctx, { imageBase64, mimeType }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured in Convex environment");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an automated schedule parser. The user has uploaded an image of a weekly school schedule.

Output ONLY a raw JSON array of objects with no markdown, no commentary.

For every class block in the grid create an object with:
  - day_of_week  : the day label exactly as shown (e.g. "Monday", "Day A", "Day B")
  - start_time   : start time string (e.g. "08:17 AM")
  - end_time     : end time string (e.g. "09:13 AM")
  - subject      : full class name (e.g. "Health & Physical Education 8")
  - room         : exact room code (e.g. "C2", "104", "Cafe")

Ignore specific dates, teacher names, and district codes.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 8192,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message ?? `Groq error ${res.status}`);
    }

    const data = await res.json() as { choices: { message: { content: string }; finish_reason: string }[] };
    if (data.choices[0].finish_reason === "length") {
      throw new Error("Schedule image produced too much output — try cropping it to just the schedule grid.");
    }
    const raw = data.choices[0].message.content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(raw) as {
      day_of_week: string;
      start_time: string;
      end_time: string;
      subject: string;
      room: string;
    }[];
  },
});
