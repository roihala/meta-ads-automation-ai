"""
Clean facade over the legacy `meta_ads_manager.MetaAdsManager`.

Two responsibilities beyond delegation:

1. Return JSON-safe dicts (never `facebook_business` SDK objects) so tools can
   `json.dumps(...)` the result without custom encoders.
2. Add methods absent from the legacy manager but required by the optimizer:
   `fetch_insights`, `update_status`, `update_budget`.

The legacy manager stays as-is — this is the stable API surface the rest of
the codebase should import. Do not reach through to `._manager` from tools;
if something is missing, add a method here.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Literal

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from facebook_business.adobjects.ad import Ad  # noqa: E402
from facebook_business.adobjects.adset import AdSet  # noqa: E402
from facebook_business.adobjects.campaign import Campaign  # noqa: E402

from meta_ads_manager import MetaAdsManager  # noqa: E402

from .config import Config  # noqa: E402

ObjectType = Literal["campaign", "adset", "ad"]
StatusValue = Literal["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]
InsightLevel = Literal["account", "campaign", "adset", "ad"]

_OBJECT_CLASS: dict[str, type] = {
    "campaign": Campaign,
    "adset": AdSet,
    "ad": Ad,
}

_DEFAULT_INSIGHT_FIELDS = [
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "impressions",
    "reach",
    "frequency",
    "spend",
    "clicks",
    "ctr",
    "cpm",
    "cpc",
    "actions",
    "action_values",
    "video_play_actions",
    "video_thruplay_watched_actions",
    "date_start",
    "date_stop",
]


class MetaClient:
    def __init__(self, config: Config | None = None):
        self._config = config or Config.load()
        self._config.require_meta()
        self._manager: MetaAdsManager | None = None

    def _m(self) -> MetaAdsManager:
        if self._manager is None:
            self._manager = MetaAdsManager(
                app_id=self._config.meta_app_id,
                app_secret=self._config.meta_app_secret,
                access_token=self._config.meta_access_token,
                ad_account_id=self._config.meta_ad_account_id,
            )
        return self._manager

    # ---------------------------------------------------------------- media

    def upload_image(self, image_path: str, name: str | None = None) -> dict:
        image_hash = self._m().upload_image(image_path, image_name=name)
        return {"image_hash": image_hash}

    def upload_video(self, video_path: str, name: str | None = None) -> dict:
        video_id = self._m().upload_video(video_path, video_name=name)
        return {"video_id": video_id}

    # --------------------------------------------------------- object create

    def create_campaign(
        self,
        name: str,
        objective: str = "OUTCOME_TRAFFIC",
        status: StatusValue = "PAUSED",
        special_ad_categories: list[str] | None = None,
    ) -> dict:
        campaign = self._m().create_campaign(
            name=name,
            objective=objective,
            status=status,
            special_ad_categories=special_ad_categories,
        )
        return {
            "id": campaign.get_id(),
            "type": "campaign",
            "name": name,
            "objective": objective,
            "status": status,
        }

    def create_ad_set(
        self,
        campaign_id: str,
        name: str,
        daily_budget_usd: float,
        targeting: dict,
        optimization_goal: str = "LINK_CLICKS",
        billing_event: str = "IMPRESSIONS",
        bid_amount: int | None = None,
    ) -> dict:
        ad_set = self._m().create_ad_set(
            campaign_id=campaign_id,
            name=name,
            daily_budget_usd=daily_budget_usd,
            targeting=targeting,
            optimization_goal=optimization_goal,
            billing_event=billing_event,
            bid_amount=bid_amount,
        )
        return {
            "id": ad_set.get_id(),
            "type": "adset",
            "name": name,
            "campaign_id": campaign_id,
            "daily_budget_usd": daily_budget_usd,
            "daily_budget_agorot": self._m().usd_to_agorot(daily_budget_usd),
            "optimization_goal": optimization_goal,
        }

    def create_image_creative(
        self,
        name: str,
        image_hash: str,
        title: str,
        body: str,
        link_url: str,
        call_to_action: str = "LEARN_MORE",
        page_id: str | None = None,
    ) -> dict:
        creative = self._m().create_ad_creative(
            name=name,
            image_hash=image_hash,
            title=title,
            body=body,
            link_url=link_url,
            call_to_action_type=call_to_action,
            page_id=page_id or self._config.meta_page_id,
        )
        return {"id": creative.get_id(), "type": "creative", "kind": "image", "name": name}

    def create_video_creative(
        self,
        name: str,
        video_id: str,
        title: str,
        body: str,
        link_url: str,
        call_to_action: str = "LEARN_MORE",
        page_id: str | None = None,
        thumbnail_hash: str | None = None,
    ) -> dict:
        creative = self._m().create_video_ad_creative(
            name=name,
            video_id=video_id,
            title=title,
            body=body,
            link_url=link_url,
            call_to_action_type=call_to_action,
            page_id=page_id or self._config.meta_page_id,
            thumbnail_hash=thumbnail_hash,
        )
        return {"id": creative.get_id(), "type": "creative", "kind": "video", "name": name}

    def create_ad(
        self,
        ad_set_id: str,
        creative_id: str,
        name: str,
        status: StatusValue = "PAUSED",
    ) -> dict:
        ad = self._m().create_ad(
            ad_set_id=ad_set_id,
            creative_id=creative_id,
            name=name,
            status=status,
        )
        return {
            "id": ad.get_id(),
            "type": "ad",
            "name": name,
            "ad_set_id": ad_set_id,
            "creative_id": creative_id,
            "status": status,
        }

    # -------------------------------------------------------------- bundles

    def create_complete_image_ad(
        self,
        *,
        campaign_name: str,
        ad_name: str,
        image_path: str,
        title: str,
        body: str,
        link_url: str,
        daily_budget_usd: float,
        targeting: dict,
        objective: str = "OUTCOME_TRAFFIC",
        call_to_action: str = "LEARN_MORE",
        special_ad_categories: list[str] | None = None,
    ) -> dict:
        return self._m().create_complete_ad(
            campaign_name=campaign_name,
            ad_name=ad_name,
            image_path=image_path,
            title=title,
            body=body,
            link_url=link_url,
            daily_budget_usd=daily_budget_usd,
            targeting=targeting,
            objective=objective,
            call_to_action=call_to_action,
            special_ad_categories=special_ad_categories,
        )

    def create_complete_video_ad(
        self,
        *,
        campaign_name: str,
        ad_name: str,
        video_path: str,
        title: str,
        body: str,
        link_url: str,
        daily_budget_usd: float,
        targeting: dict,
        objective: str = "OUTCOME_AWARENESS",
        call_to_action: str = "LEARN_MORE",
        optimization_goal: str = "THRUPLAY",
        special_ad_categories: list[str] | None = None,
    ) -> dict:
        return self._m().create_complete_video_ad(
            campaign_name=campaign_name,
            ad_name=ad_name,
            video_path=video_path,
            title=title,
            body=body,
            link_url=link_url,
            daily_budget_usd=daily_budget_usd,
            targeting=targeting,
            objective=objective,
            call_to_action=call_to_action,
            optimization_goal=optimization_goal,
            special_ad_categories=special_ad_categories,
        )

    # ------------------------------------------ new methods (not in legacy)

    def fetch_insights(
        self,
        level: InsightLevel = "account",
        date_preset: str | None = "last_7d",
        time_range: dict[str, str] | None = None,
        fields: list[str] | None = None,
        filtering: list[dict] | None = None,
    ) -> list[dict]:
        """
        Fetch Meta insights at the requested level.

        `time_range` (e.g. {'since':'2026-04-01','until':'2026-04-15'}) overrides
        `date_preset` if both are provided. Returns JSON-safe dicts via
        `export_all_data()` on each row.
        """
        params: dict[str, Any] = {"level": level}
        if time_range:
            params["time_range"] = time_range
        elif date_preset:
            params["date_preset"] = date_preset
        if filtering:
            params["filtering"] = filtering

        cursor = self._m().ad_account.get_insights(
            params=params,
            fields=fields or _DEFAULT_INSIGHT_FIELDS,
        )
        return [row.export_all_data() for row in cursor]

    def update_status(
        self,
        object_type: ObjectType,
        object_id: str,
        status: StatusValue,
    ) -> dict:
        """Pause / resume / archive a campaign, ad set, or ad."""
        self._m()  # ensure FacebookAdsApi.init() has run
        klass = _OBJECT_CLASS[object_type]
        obj = klass(object_id)
        obj.api_update(params={"status": status})
        return {"id": object_id, "type": object_type, "status": status}

    def update_budget(
        self,
        object_type: Literal["adset", "campaign"],
        object_id: str,
        daily_budget_usd: float,
    ) -> dict:
        """Update daily budget on an ad set (ABO) or campaign (CBO). USD → agorot via live rate."""
        manager = self._m()
        daily_budget_agorot = manager.usd_to_agorot(daily_budget_usd)
        klass = _OBJECT_CLASS[object_type]
        obj = klass(object_id)
        obj.api_update(params={"daily_budget": daily_budget_agorot})
        return {
            "id": object_id,
            "type": object_type,
            "daily_budget_usd": daily_budget_usd,
            "daily_budget_agorot": daily_budget_agorot,
        }
