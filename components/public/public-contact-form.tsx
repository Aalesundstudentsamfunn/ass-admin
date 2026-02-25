"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Simple contact form that opens the user's email client with prefilled content.
 */
export function PublicContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const resolvedSubject = subject.trim() || "Henvendelse fra kontaktform";
    const body = [
      `Navn: ${name.trim() || "-"}`,
      `E-post: ${email.trim() || "-"}`,
      "",
      message.trim(),
    ].join("\n");

    const mailto = `mailto:it@astudent.no?subject=${encodeURIComponent(resolvedSubject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSent(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="contact-name">Navn</Label>
        <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt navn" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-email">E-post</Label>
        <Input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deg@eksempel.no"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-subject">Emne</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Hva gjelder det?"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contact-message">Melding</Label>
        <textarea
          id="contact-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Skriv meldingen din her…"
          className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/65">Sendes til `it@astudent.no` via e-postklienten din.</p>
        <Button type="submit" className="rounded-lg">
          Send melding
        </Button>
      </div>

      {sent ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          E-postklient åpnet. Hvis det ikke skjedde noe, send manuelt til `it@astudent.no`.
        </p>
      ) : null}
    </form>
  );
}
