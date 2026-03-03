import { supabase } from '../supabaseClient';

export const deductIngredients = async (orderItems: any[]) => {
  console.log('Processing ingredient deduction for items:', orderItems);

  for (const item of orderItems) {
    if (!item.variant_id) continue;

    // 1. Fetch recipe for this variant
    const { data: recipe } = await supabase
      .from('product_ingredients')
      .select('ingredient_id, quantity_required')
      .eq('variant_id', item.variant_id);

    if (recipe && recipe.length > 0) {
      console.log(`Found recipe for variant ${item.variant_id}:`, recipe);
      
      for (const ingredient of recipe) {
        const totalDeduction = ingredient.quantity_required * item.quantity;

        // 2. Fetch current ingredient stock
        const { data: ingData } = await supabase
          .from('ingredients')
          .select('id, current_stock')
          .eq('id', ingredient.ingredient_id)
          .single();

        if (ingData) {
          const newStock = ingData.current_stock - totalDeduction;
          
          // 3. Update stock
          await supabase
            .from('ingredients')
            .update({ current_stock: newStock })
            .eq('id', ingredient.ingredient_id);
            
          console.log(`Deducted ${totalDeduction} from ingredient ${ingredient.ingredient_id}. New Stock: ${newStock}`);
        }
      }
    }
  }
};
