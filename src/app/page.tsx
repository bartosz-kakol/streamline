"use client";

import { Box, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import CastConnectedIcon from "@mui/icons-material/CastConnected";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Home() {
    const router = useRouter();
    const { t } = useTranslation();

    const handleCreateSession = async () => {
        const roomId = uuidv4();

        router.push(`/stream/${roomId}`);
    };

    return (
        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "background.default" }}>
            <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box component="img" src="/logo.png" alt="StreamLine logo" sx={{ height: 40, width: "auto" }} />
                <LanguageSwitcher />
            </Box>
            <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Button
                    variant="contained"
                    size="large"
                    onClick={handleCreateSession}
                    startIcon={<CastConnectedIcon />}
                    sx={{ py: 2.5, px: 5, fontSize: "1.1rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
                >
                    {t("landing.title")}
                </Button>
            </Box>
        </Box>
    );
}
