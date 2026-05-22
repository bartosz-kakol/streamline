"use client";

import { Button, Menu, MenuItem } from "@mui/material";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import TranslateIcon from "@mui/icons-material/Translate";
import "../lib/i18n";

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        handleClose();
    };

    if (!mounted) return null;

    return (
        <>
            <Button
                color="inherit"
                onClick={handleClick}
                startIcon={<TranslateIcon />}
            >
                {i18n.language?.startsWith("pl") ? "Polski" : "English"}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                <MenuItem onClick={() => changeLanguage("en")}>English</MenuItem>
                <MenuItem onClick={() => changeLanguage("pl")}>Polski</MenuItem>
            </Menu>
        </>
    );
}
