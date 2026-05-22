"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Switch, FormControlLabel, Select, MenuItem, Stepper, Step, StepLabel, Alert, AlertTitle } from "@mui/material";
import { useTranslation } from "react-i18next";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import SpeakerIcon from "@mui/icons-material/Speaker";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

type SourceType = "screen" | MediaDeviceInfo;

interface SelectedSources {
  video: SourceType | null;
  audio: {
    enabled: boolean;
    screen: boolean;
    device: MediaDeviceInfo | null;
  };
}

interface PrepareStreamDialogProps {
  open: boolean;
  permissionsDenied: boolean;
  onGoLive: (stream: MediaStream) => void;
  onClose: () => void;
}

export default function PrepareStreamDialog({ open, permissionsDenied, onGoLive, onClose }: PrepareStreamDialogProps) {
    const { t } = useTranslation();
    const [activeStep, setActiveStep] = useState(0);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [devicePreviews, setDevicePreviews] = useState<Record<string, MediaStream>>({});
    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  
    const [selectedSources, setSelectedSources] = useState<SelectedSources>({
        video: null,
        audio: { enabled: true, screen: false, device: null }
    });

    useEffect(() => {
        if (open && !permissionsDenied) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                setVideoDevices(devices.filter(d => d.kind === "videoinput"));
                setAudioDevices(devices.filter(d => d.kind === "audioinput"));
            }).catch(console.error);
        }
    }, [open, permissionsDenied]);

    useEffect(() => {
        if (!open || permissionsDenied || videoDevices.length === 0) {
            return;
        }

        const active = { cancelled: false };
        const streams: MediaStream[] = [];

        const loadPreviews = async () => {
            const previewStreams: Record<string, MediaStream> = {};

            await Promise.all(videoDevices.map(async (device) => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: device.deviceId } },
                        audio: false
                    });
                    if (!active.cancelled) {
                        previewStreams[device.deviceId] = stream;
                        streams.push(stream);
                    } else {
                        stream.getTracks().forEach(track => track.stop());
                    }
                } catch (error) {
                    console.error("Failed to load preview for device", device.label || device.deviceId, error);
                }
            }));

            if (!active.cancelled) {
                setDevicePreviews(previewStreams);
            }
        };

        loadPreviews();

        return () => {
            active.cancelled = true;
            streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
            setDevicePreviews({});
        };
    }, [open, permissionsDenied, videoDevices]);

    useEffect(() => {
        Object.entries(devicePreviews).forEach(([deviceId, stream]) => {
            const videoElement = videoRefs.current[deviceId];
            if (videoElement && videoElement.srcObject !== stream) {
                videoElement.srcObject = stream;
            }
        });
    }, [devicePreviews, activeStep]);

    const handleVideoSelect = (source: SourceType) => {
        setSelectedSources(prev => ({ ...prev, video: source }));
        setActiveStep(1);
    };

    const handleAudioNext = () => {
        setActiveStep(2);
    };

    const createStream = async () => {
        try {
            const audioContext = new AudioContext();
            const audioDestination = audioContext.createMediaStreamDestination();
            let desktopStream: MediaStream | null = null;
            let videoStream: MediaStream;

            if (selectedSources.video === "screen") {
                desktopStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: selectedSources.audio.screen ? {
                        autoGainControl: false,
                        channelCount: 2,
                        echoCancellation: false,
                        noiseSuppression: false,
                    } : false
                });
                videoStream = desktopStream;

                if (selectedSources.audio.screen && desktopStream.getAudioTracks().length > 0) {
                    const desktopAudioSource = audioContext.createMediaStreamSource(desktopStream);
                    desktopAudioSource.connect(audioDestination);
                }
            } else {
                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: (selectedSources.video as MediaDeviceInfo).deviceId } },
                    audio: false
                });
            }

            if (selectedSources.audio.enabled && selectedSources.audio.device) {
                const deviceStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: { deviceId: { exact: selectedSources.audio.device.deviceId } }
                });
                const deviceAudioSource = audioContext.createMediaStreamSource(deviceStream);
                deviceAudioSource.connect(audioDestination);
            }

            const finalStream = new MediaStream();
            videoStream.getVideoTracks().forEach(track => finalStream.addTrack(track));
      
            if (selectedSources.audio.enabled && audioDestination.stream.getAudioTracks().length > 0) {
                audioDestination.stream.getAudioTracks().forEach(track => finalStream.addTrack(track));
            }

            onGoLive(finalStream);
        } catch (err) {
            console.error(err);
            alert(t("landing.error"));
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth sx={{ "& .MuiDialog-paper": { minWidth: 650, borderRadius: "24px", bgcolor: "background.paper", backgroundImage: "none" } }}>
            <DialogTitle sx={{ fontWeight: "bold", color: "primary.main" }}>{t("panel.prepareStream")}</DialogTitle>
      
            <Stepper activeStep={activeStep} sx={{ px: 3, py: 2 }}>
                <Step><StepLabel>{t("panel.video")}</StepLabel></Step>
                <Step><StepLabel>{t("panel.audio")}</StepLabel></Step>
                <Step><StepLabel>{t("panel.summary")}</StepLabel></Step>
            </Stepper>

            <DialogContent sx={{ minHeight: 300 }}>
                {activeStep === 0 && (
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2, alignItems: "start" }}>
                        <Box 
                            onClick={() => handleVideoSelect("screen")}
                            sx={{ 
                                p: 2, border: "1px solid", borderColor: "divider", 
                                borderRadius: 2, cursor: "pointer", textAlign: "center", overflow: "hidden", "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" } 
                            }}
                        >
                            <Box sx={{ aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", borderRadius: 1, mb: 2 }}>
                                <DesktopWindowsIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                            </Box>
                            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{t("panel.fromPc")}</Typography>
                        </Box>
                        {!permissionsDenied && videoDevices.map(device => (
                            <Box 
                                key={device.deviceId}
                                onClick={() => handleVideoSelect(device)}
                                sx={{ 
                                    border: "1px solid", borderColor: "divider", 
                                    borderRadius: 2, cursor: "pointer", overflow: "hidden", "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" } 
                                }}
                            >
                                <Box sx={{ position: "relative", aspectRatio: "16/9", bgcolor: "background.default" }}>
                                    {devicePreviews[device.deviceId] ? (
                                        <video
                                            ref={el => { videoRefs.current[device.deviceId] = el; }}
                                            muted
                                            playsInline
                                            autoPlay
                                            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <VideocamIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{ p: 2, textAlign: "center" }}>
                                    <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{device.label || t("panel.unknownDevice")}</Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <Box sx={{ bgcolor: "background.paper", display: "grid", gridTemplateColumns: "auto 1fr", gap: 2, alignItems: "center" }}>
                            <VolumeUpIcon color="primary" sx={{ fontSize: 36 }} />
                            <Box>
                                <FormControlLabel 
                                    control={<Switch checked={selectedSources.audio.enabled} onChange={e => setSelectedSources(prev => ({ ...prev, audio: { ...prev.audio, enabled: e.target.checked } }))} />} 
                                    label={<Typography sx={{ fontWeight: "bold" }}>{t("panel.audioEnabled")}</Typography>} 
                                />
                                <Typography variant="body2" color="text.secondary">{t("panel.audioEnabledDesc")}</Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, alignItems: "stretch" }}>
                            <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, display: "grid", gridTemplateColumns: "auto 1fr", gap: 2, alignItems: "start", opacity: selectedSources.audio.enabled ? 1 : 0.5, pointerEvents: selectedSources.audio.enabled ? "auto" : "none" }}>
                                <SpeakerIcon color="primary" sx={{ fontSize: 36, mt: 0.5 }} />
                                <Box>
                                    <FormControlLabel 
                                        control={<Switch disabled={selectedSources.video !== "screen"} checked={selectedSources.video === "screen" && selectedSources.audio.screen} onChange={e => setSelectedSources(prev => ({ ...prev, audio: { ...prev.audio, screen: e.target.checked } }))} />} 
                                        label={<Typography sx={{ fontWeight: "bold" }}>{t("panel.audioFromPc")}</Typography>} 
                                    />
                                    <Typography variant="body2" color="text.secondary">{t("panel.audioFromPcDesc")}</Typography>
                                </Box>
                            </Box>

                            {!permissionsDenied ? (
                                <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, display: "grid", gridTemplateColumns: "auto 1fr", gap: 2, alignItems: "start", opacity: selectedSources.audio.enabled ? 1 : 0.5, pointerEvents: selectedSources.audio.enabled ? "auto" : "none" }}>
                                    <MicIcon color="primary" sx={{ fontSize: 36, mt: 0.5 }} />
                                    <Box>
                                        <FormControlLabel 
                                            control={<Switch checked={!!selectedSources.audio.device} onChange={e => setSelectedSources(prev => ({ ...prev, audio: { ...prev.audio, device: e.target.checked ? (audioDevices[0] || null) : null } }))} />} 
                                            label={<Typography sx={{ fontWeight: "bold" }}>{t("panel.audioFromDevice")}</Typography>} 
                                        />
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t("panel.audioFromDeviceDesc")}</Typography>
                                        <Select 
                                            fullWidth 
                                            size="small" 
                                            disabled={!selectedSources.audio.device}
                                            value={selectedSources.audio.device?.deviceId || ""} 
                                            onChange={e => {
                                                const dev = audioDevices.find(d => d.deviceId === e.target.value);
                                                if (dev) setSelectedSources(prev => ({ ...prev, audio: { ...prev.audio, device: dev } }));
                                            }}
                                            sx={{ borderRadius: 2 }}
                                        >
                                            {audioDevices.map(d => (
                                                <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || t("panel.unknownDevice")}</MenuItem>
                                            ))}
                                        </Select>
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, display: "grid", gridTemplateColumns: "auto 1fr", gap: 2, alignItems: "start", opacity: selectedSources.audio.enabled ? 1 : 0.5, pointerEvents: selectedSources.audio.enabled ? "auto" : "none" }}>
                                    <MicIcon color="primary" sx={{ fontSize: 36, mt: 0.5 }} />
                                    <Box>
                                        <Typography sx={{ fontWeight: "bold" }}>{t("panel.audioFromDevice")}</Typography>
                                        <Alert
                                            severity="error"
                                        >
                                            <AlertTitle>{t("panel.audioFromDeviceNoPermissionsErrorTitle")}</AlertTitle>
                                            {t("panel.audioFromDeviceNoPermissionsErrorDesc")}
                                        </Alert>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}

                {activeStep === 2 && (
                    <Box sx={{ textAlign: "center", mt: 4 }}>
                        <Typography variant="h4" color="primary" gutterBottom sx={{ fontWeight: "bold" }}>{t("panel.ready")}</Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", mt: 4 }}>
                            <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 4, width: "100%" }}>
                                <Typography variant="body2" color="text.secondary">{t("panel.video")}</Typography>
                                <Typography sx={{ fontWeight: "bold" }}>
                                    {selectedSources.video === "screen" ? t("panel.fromPc") : (selectedSources.video as MediaDeviceInfo)?.label || t("panel.unknownDevice")}
                                </Typography>
                            </Box>
                            <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 4, width: "100%" }}>
                                <Typography variant="body2" color="text.secondary">{t("panel.audio")}</Typography>
                                <Typography sx={{ fontWeight: "bold" }}>
                                    {!selectedSources.audio.enabled ? t("panel.none") : 
                                        [
                                            selectedSources.audio.screen ? t("panel.fromPc") : null,
                                            selectedSources.audio.device ? (selectedSources.audio.device.label || t("panel.unknownDevice")) : null
                                        ].filter(Boolean).join(" + ") || t("panel.none")
                                    }
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
                {activeStep > 0 && <Button onClick={() => setActiveStep(prev => prev - 1)}>{t("panel.back")}</Button>}
                {activeStep === 0 && <Button onClick={onClose} color="inherit">{t("panel.minimize")}</Button>}
                {activeStep === 1 && <Button variant="contained" onClick={handleAudioNext}>{t("panel.next")}</Button>}
                {activeStep === 2 && <Button variant="contained" onClick={createStream}>{t("panel.goLive")}</Button>}
            </DialogActions>
        </Dialog>
    );
}
