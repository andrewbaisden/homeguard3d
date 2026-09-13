import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewPropertyForm } from "./new-property-form";

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>New property</CardTitle>
          <CardDescription>
            You become this property&apos;s owner. Floors and rooms are added next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewPropertyForm />
        </CardContent>
      </Card>
    </div>
  );
}
