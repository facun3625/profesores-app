// apps/web/src/app/admin/page.tsx
import { AdminContent } from "./AdminContent";

export const metadata = {
    title: "Admin Maestro | Profly",
};

export default function AdminPage() {
    return (
        <div className="container mx-auto py-8">
            <AdminContent />
        </div>
    );
}
