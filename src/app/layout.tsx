import type { Metadata } from "next";
import ThemeRegistry from "../components/ThemeRegistry";

export const metadata: Metadata = {
    title: "StreamLine",
    description: "Private live transmissions made easy.",
};

export default function RootLayout({
    children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <ThemeRegistry>{children}</ThemeRegistry>
            </body>
        </html>
    );
}
