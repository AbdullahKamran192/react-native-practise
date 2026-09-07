import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

type Product = {
  product_name: string;
  nutriments: {
    energy_kcal_100g: number;
    fat_100g: number;
    carbohydrates_100g: number;
    proteins_100g: number;
    sugars_100g: number;
    salt_100g: number;
  };
};

const App = () => {
  const { data: myData } = useLocalSearchParams();

  const [isLoading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);

  const getProduct = async () => {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${myData}.json`
      );

      const json = await response.json();

      console.log(json.product);

      setProduct(json.product);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getProduct();
  }, []);

  if (isLoading) {
    return <ActivityIndicator />;
  }

  if (!product) {
    return <Text>Product not found</Text>;
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text>{product.product_name}</Text>

      <Text>Calories: {product.nutriments.energy_kcal_100g} kcal</Text>
      <Text>Fat: {product.nutriments.fat_100g} g</Text>
      <Text>Carbohydrates: {product.nutriments.carbohydrates_100g} g</Text>
      <Text>Sugars: {product.nutriments.sugars_100g} g</Text>
      <Text>Protein: {product.nutriments.proteins_100g} g</Text>
      <Text>Salt: {product.nutriments.salt_100g} g</Text>

      <Text>Barcode: {myData}</Text>
    </View>
  );
};

export default App;
