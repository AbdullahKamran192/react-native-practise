import { View, Text, SafeAreaView, FlatList } from 'react-native'
import React, { useState } from 'react'
import PantryDashboard from '@/components/pantry/PantryDashboard'
import { products } from '@/data/products'

const pantry = () => {

  let caloriesTotal = 0;

  products.forEach((product) => {
    caloriesTotal += product.calories
  })

  return (
    <SafeAreaView style={{backgroundColor: 'lightgray'}}>
      <Text>pantry</Text>
      <PantryDashboard caloriesTotal={caloriesTotal} />
      <FlatList
        data={products}
        renderItem={({ item }) => (
          <View>
            <Text>Name: {item.name}</Text>
            <Text>Calories: {item.calories}</Text>
            <Text>Protein: {item.protein}g</Text>
          </View>
        )}
      />
      <Text>total calories: {caloriesTotal}</Text>
    </SafeAreaView>
  )
}

export default pantry