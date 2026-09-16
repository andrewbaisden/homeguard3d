import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPinned } from "lucide-react";
import { NewPropertyForm } from "./new-property-form";

export default function NewPropertyPage() {
  return (
    <div className="page-shell">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[1.8rem] bg-[#fffbed]/80 shadow-[0_24px_70px_rgba(21,63,58,0.1)] ring-1 ring-foreground/10 md:grid-cols-[0.8fr_1.2fr]">
        <div className="relative overflow-hidden bg-[#6957e8] p-8 text-white sm:p-10">
          <div className="absolute -bottom-20 -right-16 size-64 rounded-full border-[3.5rem] border-[#f3a7c4]/35" />
          <div className="relative flex h-full min-h-64 flex-col justify-between">
            <span className="grid size-12 place-items-center rounded-full bg-white/15">
              <MapPinned className="size-5" />
            </span>
            <div>
              <p className="text-3xl font-semibold leading-tight tracking-[-0.05em]">
                Every great twin starts with a place.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                Name your property now. Floors, rooms and connected devices come next.
              </p>
            </div>
          </div>
        </div>
        <Card className="justify-center rounded-none bg-transparent px-3 py-8 shadow-none ring-0 sm:px-8 sm:py-12">
          <CardHeader>
            <span className="eyebrow mb-3">New property</span>
            <CardTitle className="text-4xl font-semibold tracking-[-0.055em]">
              Set the foundations.
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              You&apos;ll be the owner of this property.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewPropertyForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
