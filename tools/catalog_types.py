#!/usr/bin/env python3
"""Typed canonical domain models for catalog compiler data.

The checked-in JSON Schemas remain the runtime source of truth.  These types
model the validated in-process representation after a schema boundary has
accepted the payload, so compiler/build code does not need to propagate
``dict[str, Any]`` through the core.
"""
from __future__ import annotations

from typing import Literal, NotRequired, TypeAlias, TypedDict

ImageExtension: TypeAlias = Literal["webp", "jpg", "png"]
PageSize: TypeAlias = list[int]


class CatalogSourceInputOptional(TypedDict, total=False):
    description: str
    category: str
    subcategory: str
    ocr: bool
    sort: int
    badge: str
    pageNumberStart: int


class CatalogSourceInput(CatalogSourceInputOptional):
    id: str
    title: str
    pdf: str


class CatalogSourceOptional(TypedDict, total=False):
    sort: int
    badge: str


class CatalogSource(CatalogSourceOptional):
    id: str
    title: str
    description: str
    category: str
    subcategory: str
    pdf: str
    ocr: bool
    pageNumberStart: int


CatalogConfig: TypeAlias = list[CatalogSource]


class TaxonomyCategory(TypedDict):
    name: str
    slug: str
    description: str


class TaxonomySubcategory(TypedDict):
    category: str
    name: str
    slug: str
    description: str


class TaxonomyConfig(TypedDict):
    categories: list[TaxonomyCategory]
    subcategories: list[TaxonomySubcategory]


class SearchPage(TypedDict):
    page: int
    text: str


class StateImageVariant(TypedDict):
    maxSide: int
    version: str


class StateImageVariants(TypedDict):
    thumb: StateImageVariant
    medium: StateImageVariant
    full: StateImageVariant


class CatalogArtifact(TypedDict):
    id: str
    pages: int
    imageExt: ImageExtension
    assetVersion: str
    imageVariants: StateImageVariants
    searchPages: list[SearchPage]
    pageSizes: NotRequired[list[PageSize]]


class CatalogBuildState(TypedDict):
    version: Literal[1]
    catalogs: list[CatalogArtifact]


class PublicImageVariant(TypedDict):
    directory: str
    maxSide: int
    version: str


class PublicImageVariants(TypedDict):
    thumb: PublicImageVariant
    medium: PublicImageVariant
    full: PublicImageVariant


class GeneratedCatalogOptional(TypedDict, total=False):
    subcategory: str
    pageSizes: list[PageSize]
    sort: int
    badge: str


class GeneratedCatalog(GeneratedCatalogOptional):
    id: str
    title: str
    description: str
    category: str
    pages: int
    pageNumberStart: int
    dir: str
    cover: str
    imageExt: ImageExtension
    assetVersion: str
    imageVariants: PublicImageVariants


GeneratedCatalogs: TypeAlias = list[GeneratedCatalog]


class SearchCatalog(TypedDict):
    catalogId: str
    title: str
    pages: list[SearchPage]


SearchCatalogs: TypeAlias = list[SearchCatalog]


class SearchIndexStats(TypedDict):
    catalogs: int
    pages: int
    tokens: int
    categoryPages: dict[str, int]


class SearchIndexNormalizedCatalogFields(TypedDict):
    title: str
    description: str
    category: str


class SearchIndexCatalog(TypedDict):
    id: str
    title: str
    description: str
    category: str
    sort: int
    normalized: SearchIndexNormalizedCatalogFields


class SearchIndexDocument(TypedDict):
    catalog: int
    page: int
    text: str
    normalized: str


class SearchIndex(TypedDict):
    version: Literal[1]
    stats: SearchIndexStats
    catalogs: list[SearchIndexCatalog]
    documents: list[SearchIndexDocument]
    terms: dict[str, list[int]]
