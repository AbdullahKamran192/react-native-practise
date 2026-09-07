import { View, Text, StyleSheet } from 'react-native'
import React from 'react'

type PantryDashboardProps = {
  caloriesTotal: number;
};

const PantryDashboard = ({caloriesTotal} : PantryDashboardProps) => {
  return (
    <View style={styles.pantryDashboard}>
        <View style={styles.titleSection}>
            <Text style={styles.title}>Your Pantry</Text>
            <Text>Calories: {caloriesTotal}</Text>
        </View>
    </View>
  )
}

export default PantryDashboard

const styles = StyleSheet.create({
    pantryDashboard: {
        backgroundColor: 'white',
        height: 200,
        margin: 10,
        borderRadius: 20,
    },
    titleSection: {
        alignItems: 'center',
        backgroundColor: 'pink'
    },
    title: {
        fontSize: 18,
    }
})