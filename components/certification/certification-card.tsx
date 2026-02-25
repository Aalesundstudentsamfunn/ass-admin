"use client"

import React, { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"

type Profiles = { id: string; firstname?: string | null; lastname?: string | null; avatar_url?: string | null, email?: string | null }
type Types = { id: number; type: string }
type Verified_by_profile = { id: string; firstname?: string | null; lastname?: string | null; email?: string | null }

export type AppShape = {
  id: number
  created_at: string
  time_accepted?: string | null
  certificate_id?: number | null
  verified: boolean
  verified_by?: string | null
  seeker_id?: string | null
  rejected?: boolean | null
  cert_image_id?: string | null
  notes?: string | null
  profiles?: Profiles | null
  type?: Types | null
  verified_by_profile?: Verified_by_profile | null
}

/**
 * Card for one certification application with status, preview, and actions.
 *
 * How: Renders action buttons based on `canManage` and keeps local dialogs for details/delete confirmation.
 */
export default function CertificationCard({
  app,
  onAccept,
  onReject,
  onDelete,
  canManage = true,
}: {
  app: AppShape;
  onAccept?: (id: number) => void;
  onReject?: (id: number) => void;
  onDelete?: (id: number) => void;
  canManage?: boolean;
}) {
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const allowActions = canManage;

  /**
   * Accept action dispatcher for the current card.
   *
   * How: Calls `onAccept` with current application id when handler exists.
   * @returns void
   */
  function handleAccept() {
    if (onAccept) onAccept(app.id)
  }

  /**
   * Reject action dispatcher for the current card.
   *
   * How: Calls `onReject` with current application id when handler exists.
   * @returns void
   */
  function handleReject() {
    if (onReject) onReject(app.id)
  }

  /**
   * Confirms deletion of the current application.
   *
   * How: Calls `onDelete` then closes the delete confirmation dialog.
   * @returns void
   */
  function handleDeleteConfirm() {
    if (onDelete) onDelete(app.id)
    setDeleteOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div>
            <CardTitle>{app.type ? `${app.type.type} - ` : "ukjent type(feil)"}{app.profiles ? `${app.profiles.firstname ?? ""} ${app.profiles.lastname ?? ""}` : "Ukjent"}</CardTitle>
            <CardDescription className="text-sm">Søknr: #{app.id} • {new Date(app.created_at).toLocaleString("no-NO")}</CardDescription>
          </div>
          <div className="text-right">
            {app.verified ? (
              <div className="space-y-1">
                <Badge variant="default">Akseptert</Badge>
                {app.verified_by_profile ? <div className="text-xs text-muted-foreground">Godkjent av: {app.verified_by_profile.firstname} {app.verified_by_profile.lastname}</div> : <div className="text-xs text-muted-foreground">???</div>}
              </div>
            ) : app.rejected ? (
              <Badge variant="destructive">Avslått</Badge>
            ) : (
              <Badge variant="outline">Ubehandlet</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {app.cert_image_id ? (
          // request image through our proxy API so the server includes the Authorization header
          <div className="relative w-full h-48 rounded-md overflow-hidden">
            <Image src={app.cert_image_id} alt="certificate" fill style={{ objectFit: "cover" }} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
          </div>
        ) : (
          <div className="h-48 w-full rounded-md bg-muted-foreground/10 flex items-center justify-center text-sm">Ingen bilde</div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">{app.notes ?? "Ingen notater"}</p>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-2">
          {allowActions && !app.verified ? <Button variant="default" size="sm" onClick={handleAccept}>Bekreft</Button> : null}
          {allowActions && !app.rejected && !app.verified ? <Button variant="destructive" size="sm" onClick={handleReject}>Avslå</Button> : null}
          {allowActions && !app.verified ? <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>Slett</Button> : null}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Detaljer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Detaljer for søknad #{app.id} - {app.type ? `${app.type.type}` : "ukjent type(feil)"}</DialogTitle>
                <DialogDescription>Informasjon og bilde.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Status</div>
                  <div>
                    {app.verified ? (
                      <Badge variant="default">Akseptert</Badge>
                    ) : app.rejected ? (
                      <Badge variant="destructive">Avslått</Badge>
                    ) : (
                      <Badge variant="outline">Ubehandlet</Badge>
                    )}
                  </div>
                </div>
                {app.cert_image_id ? (
                  // request image through our proxy API so the server includes the Authorization header
                  <div className="relative w-full h-48 rounded-md overflow-hidden">
                    <Image src={app.cert_image_id} alt="certificate" fill style={{ objectFit: "cover" }} sizes="fit" />
                  </div>
                ) : (
                  <div className="h-48 w-full rounded-md bg-muted-foreground/10 flex items-center justify-center text-sm">Ingen bilde</div>
                )}
                <div>
                  <div className="font-medium">Navn</div>
                  <div>{app.profiles ? `${app.profiles.firstname ?? ""} ${app.profiles.lastname ?? ""}` : "Ukjent"}</div>
                </div>
                {app.verified && app.verified_by ? (
                  <div>
                    <div className="font-medium">Godkjent av</div>
                    <div>{app.verified_by}</div>
                  </div>
                ) : null}
                <div>
                  <div className="font-medium">Notat</div>
                  <div>{app.notes ?? "Ingen notater"}</div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {allowActions ? (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Slett søknad #{app.id}?</DialogTitle>
                  <DialogDescription>Dette kan ikke angres. Er du sikker på at du vil slette denne søknaden?</DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Avbryt</Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteConfirm}>Slett</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  )
}
