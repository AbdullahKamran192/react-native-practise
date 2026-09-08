import { View, Text } from 'react-native'
import React from 'react'

const MissingInfo = ({nutrition}) => {
  return (
    <View style={{backgroundColor: 'yellow'}}>
      <Text>MissingInfo</Text>
      <Text>The {nutrition} value is missing</Text>
    </View>
  )
}

export default MissingInfo