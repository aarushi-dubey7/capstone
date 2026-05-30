import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

export const sendToMainOffice = action({
  args: {
    teacherId: v.id("teachers"),
    date: v.optional(v.string()),
    dayLabel: v.optional(v.string()),
    blockLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const roster = await ctx.runQuery(api.attendance.getTeacherRoster, args);
    if (!roster.activeClass) {
      throw new Error("No active class found for this block.");
    }

    const officeEmails = await ctx.runQuery(api.officeEmails.list);
    const activeEmails = officeEmails.filter((e) => e.active).map((e) => e.email);

    if (activeEmails.length === 0) {
      throw new Error("No active main office emails configured.");
    }

    const className = roster.activeClass.name;
    const blockName = roster.selectedBlockLabel ?? "N/A";
    const grade = roster.activeClass.grade ?? "N/A";
    const subject = `Attendance Report: ${className} - ${blockName} - Grade ${grade}`;

    const rows = roster.students.map((s) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${s.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${s.studentNumber}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${s.status}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${s.activityLabel ?? ""}</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family: sans-serif; color: #333;">
        <h2 style="color: #1e293b;">Attendance Report</h2>
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <p style="margin: 5px 0;"><strong>Class:</strong> ${className}</p>
          <p style="margin: 5px 0;"><strong>Block:</strong> ${blockName}</p>
          <p style="margin: 5px 0;"><strong>Grade:</strong> ${grade}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${roster.date}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Student Name</th>
              <th style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">ID</th>
              <th style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Status</th>
              <th style="padding: 12px 8px; border: 1px solid #e2e8f0; text-align: left; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Notes/Activity</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">Sent via Attendance System</p>
      </div>
    `;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Attendance System <attendance@resend.dev>",
        to: activeEmails,
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    return { success: true };
  },
});
