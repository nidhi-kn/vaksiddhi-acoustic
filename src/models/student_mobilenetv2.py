import torch
import torch.nn as nn
from torchvision.models import mobilenet_v2, MobileNet_V2_Weights


class MobileNetV2Student(nn.Module):
    """One-channel log-Mel spectrogram classifier: bonafide vs spoof."""

    def __init__(self, pretrained=True):
        super().__init__()

        weights = MobileNet_V2_Weights.DEFAULT if pretrained else None
        self.model = mobilenet_v2(weights=weights)

        # Adapt the pretrained RGB input layer to one-channel audio features.
        old_conv = self.model.features[0][0]

        new_conv = nn.Conv2d(
            in_channels=1,
            out_channels=old_conv.out_channels,
            kernel_size=old_conv.kernel_size,
            stride=old_conv.stride,
            padding=old_conv.padding,
            dilation=old_conv.dilation,
            groups=old_conv.groups,
            bias=False,
        )

        with torch.no_grad():
            if pretrained:
                new_conv.weight.copy_(
                    old_conv.weight.mean(dim=1, keepdim=True)
                )

        self.model.features[0][0] = new_conv

        # Binary classification: 0 = bonafide, 1 = spoof.
        self.model.classifier[1] = nn.Linear(
            self.model.classifier[1].in_features, 2
        )

    def forward(self, x):
        return self.model(x)


if __name__ == "__main__":
    model = MobileNetV2Student(pretrained=False)
    model.eval()

    dummy_input = torch.randn(2, 1, 80, 101)

    with torch.no_grad():
        output = model(dummy_input)

    print("Model: MobileNetV2Student")
    print("Input shape:", tuple(dummy_input.shape))
    print("Output shape:", tuple(output.shape))
    print("Parameters:", sum(p.numel() for p in model.parameters()))
    print("Smoke test passed." if output.shape == (2, 2) else "Smoke test failed.")
