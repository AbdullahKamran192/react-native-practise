import {
  useEffect,
  useState,
} from "react";

import {
  lookupProduct,
} from "@/api/products/productLookup";

import {
  lookupGenericProduct,
} from "@/api/products/productLookup/genericDatabase";

import {
  createEmptyProduct,
} from "@/api/products/productLookup/utils";

import type {
  LookupProduct,
} from "@/api/products/productLookup";

export type ProductSource =
  | "barcode"
  | "generic";

export type LookupStatus =
  | "found"
  | "not-found"
  | "error"
  | null;

type UseSelectedProductParameters = {
  data?: string;
  source?: ProductSource;
  productId?: string;
};

type UseSelectedProductResult = {
  product: LookupProduct | null;
  setProduct: React.Dispatch<
    React.SetStateAction<LookupProduct | null>
  >;
  isLoading: boolean;
  lookupStatus: LookupStatus;
  isGenericProduct: boolean;
  barcode: string | undefined;
  genericProductId: string | undefined;
  productIdentifier: string;
};

/*
 * Loads the product selected by the user.
 *
 * A product can arrive from:
 *
 * 1. The barcode scanner:
 *    data contains the scanned barcode.
 *
 * 2. The product search screen:
 *    productId contains either a barcode or a
 *    generic-product ID.
 *
 * The source parameter determines whether productId
 * represents a barcode product or generic product.
 */
export function useSelectedProduct({
  data,
  source,
  productId,
}: UseSelectedProductParameters): UseSelectedProductResult {
  const isGenericProduct =
    source === "generic";

  /*
   * Barcode products can come from either:
   *
   * - productId when selected through search
   * - data when scanned using the barcode scanner
   */
  const barcode =
    source === "barcode"
      ? productId
      : data;

  /*
   * Generic products always use the generated ID
   * supplied through productId.
   */
  const genericProductId =
    isGenericProduct
      ? productId
      : undefined;

  const productIdentifier =
    barcode ??
    genericProductId ??
    "";

  const [
    product,
    setProduct,
  ] = useState<LookupProduct | null>(
    null
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    lookupStatus,
    setLookupStatus,
  ] = useState<LookupStatus>(null);

  useEffect(() => {
    /*
     * This prevents an older lookup from updating
     * state after the selected product changes or
     * the component using this hook unmounts.
     */
    let isCurrentLookup = true;

    async function loadSelectedProduct() {
      const lookupId =
        isGenericProduct
          ? genericProductId
          : barcode;

      setIsLoading(true);
      setLookupStatus(null);
      setProduct(null);

      /*
       * No usable identifier was supplied through
       * the route.
       */
      if (!lookupId) {
        if (isCurrentLookup) {
          setProduct(
            createEmptyProduct()
          );

          setLookupStatus(
            "not-found"
          );

          setIsLoading(false);
        }

        return;
      }

      try {
        /*
         * Generic products are loaded from the
         * curated generic_products Supabase table.
         */
        if (isGenericProduct) {
          const genericProduct =
            await lookupGenericProduct(
              lookupId
            );

          if (!isCurrentLookup) {
            return;
          }

          if (genericProduct) {
            setProduct(
              genericProduct
            );

            setLookupStatus(
              "found"
            );
          } else {
            setProduct(
              createEmptyProduct()
            );

            setLookupStatus(
              "not-found"
            );
          }

          return;
        }

        /*
         * Barcode lookup checks the FoodWorth
         * database and any configured external
         * product source.
         */
        const result =
          await lookupProduct(
            lookupId
          );

        if (!isCurrentLookup) {
          return;
        }

        setProduct(result.product);

        if (result.found) {
          setLookupStatus("found");
        } else if (
          result.hadLookupError
        ) {
          setLookupStatus("error");
        } else {
          setLookupStatus(
            "not-found"
          );
        }
      } catch (error) {
        console.error(
          "Could not look up product:",
          error
        );

        if (isCurrentLookup) {
          setProduct(
            createEmptyProduct()
          );

          setLookupStatus("error");
        }
      } finally {
        if (isCurrentLookup) {
          setIsLoading(false);
        }
      }
    }

    loadSelectedProduct();

    return () => {
      isCurrentLookup = false;
    };
  }, [
    barcode,
    genericProductId,
    isGenericProduct,
  ]);

  return {
    product,
    setProduct,
    isLoading,
    lookupStatus,
    isGenericProduct,
    barcode,
    genericProductId,
    productIdentifier,
  };
}

export default useSelectedProduct;