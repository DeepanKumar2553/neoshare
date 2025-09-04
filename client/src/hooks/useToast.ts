import { createToaster } from "@ark-ui/react";

export const toaster = createToaster({
    overlap: true,
    placement: "bottom-end",
    offsets: "1.6rem",
    max: 3,
});

export const showToast = (
    title: string,
    description?: string,
    duration = 2500
) => {
    toaster.create({ title, description, duration });
};

export const showError = (title: string, description?: string) => {
    toaster.create({
        title,
        description,
        duration: 2500,
    });
};
