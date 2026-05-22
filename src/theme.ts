import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#FFEB3B",
        },
        background: {
            default: "#15130C",
            paper: "#212017",
        },
    },
    shape: {
        borderRadius: 16,
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 100,
                    textTransform: "none",
                    fontWeight: 600,
                    padding: "10px 24px",
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                },
            },
        },
    },
});

export default theme;
