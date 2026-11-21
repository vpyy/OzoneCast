"""
OzoneCast — Meteorological & Health Advisory Engine
Chuyển hóa dự báo máy học thành khuyến cáo sức khỏe và mức độ rủi ro khí quyển:
- Đảm bảo tương thích với cả PredictionPanel.jsx (cần risk_assessment, datetime)
- Đảm bảo tương thích với TomorrowPredictionCard.jsx (cần status_label, health_advisory, confidence_percent)
"""

from typing import Dict, Any

from .config import (
    LABEL_DEPLETION,
    LABEL_HIGH_UV,
    LABEL_NORMAL,
    LABEL_HIGH_OZONE
)


class AdvisoryEngine:
    """Module đánh giá mức độ nguy hại bức xạ và khuyến cáo hành động cho cộng đồng."""

    @classmethod
    def get_risk_profile(cls, status_label: str, ozone_du: float) -> Dict[str, Any]:
        """
        Trích xuất đầy đủ các trường đánh giá rủi ro và khuyến nghị y tế.
        """
        if LABEL_DEPLETION in status_label or ozone_du < 220.0:
            badge_color = "red"
            risk_level = "Nguy hại cao"
            risk_assessment = "Critical Warning: Significant Ozone Depletion Detected"
            advice = (
                "Phát hiện suy giảm tầng ozone nghiêm trọng (Ozone Hole). "
                "Cường độ bức xạ tia cực tím (UV) có thể đạt ngưỡng nguy hại cực độ. "
                "Hạn chế tối đa các hoạt động tiếp xúc trực tiếp ngoài trời và sử dụng bảo hộ che chắn tia UV."
            )
        elif LABEL_HIGH_UV in status_label or ozone_du < 265.0:
            badge_color = "amber"
            risk_level = "Cảnh báo UV cao"
            risk_assessment = "Moderate Warning: Elevated UV Radiation Risk"
            advice = (
                "Chỉ số bức xạ UV ở mức cao do tầng ozone tương đối mỏng. "
                "Cần thoa kem chống nắng quang phổ rộng, đeo kính râm chống tia UV và đội nón rộng vành khi ra ngoài vào khung giờ cao điểm 10h - 16h."
            )
        elif LABEL_HIGH_OZONE in status_label or ozone_du > 425.0:
            badge_color = "purple"
            risk_level = "Bất thường tăng cao"
            risk_assessment = "Anomalously High Ozone Column Density"
            advice = (
                "Nồng độ ozone cột khí quyển đạt mức rất dày do tích tụ hoàn lưu không khí. "
                "Khả năng hấp thụ bức xạ cực tím tối ưu, an toàn bức xạ mặt trời."
            )
        else:
            badge_color = "green"
            risk_level = "An toàn bình thường"
            risk_assessment = "Standard Healthy Ozone Layer - Adequate UV Protection"
            advice = (
                "Tầng ozone đạt nồng độ chuẩn khí quyển trong lành (265 - 420 DU). "
                "Hệ thống khí quyển hoạt động ổn định, bảo vệ tốt khỏi các tia bức xạ có hại."
            )

        return {
            "badge_color": badge_color,
            "risk_level": risk_level,
            "risk_assessment": risk_assessment,
            "health_advisory": advice
        }
